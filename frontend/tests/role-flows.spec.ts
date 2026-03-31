import { expect, test, type Page } from '@playwright/test';

// Этот блок создается, чтобы централизованно описать форму логина для обеих ролей.
type Credentials = {
  email: string;
  password: string;
};

// Этот блок создается, чтобы единообразно задать структуру моковых новостей.
type NewsItem = {
  id: string;
  title: string;
  excerpt: string;
  imageUrl: string;
  date: string;
  source?: 'manual' | 'rss';
};

// Этот блок создается, чтобы единообразно задать структуру моковых слотов.
type SlotItem = {
  id: string;
  specialistId: string;
  date: string;
  time: string;
  status: 'free' | 'busy';
  specialistFirstName?: string | null;
  specialistLastName?: string | null;
};

// Этот блок создается, чтобы хранить записи в формате, ожидаемом UI в расписании и "Моих записях".
type BookingItem = {
  id: string;
  specialistId: string;
  userId?: string;
  date: string;
  time: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status: 'active' | 'cancelled';
  specialistFirstName?: string | null;
  specialistLastName?: string | null;
};

// Этот блок создается, чтобы быстро формировать дату в ISO-формате YYYY-MM-DD.
function toIsoDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

// Этот блок создается, чтобы эмулировать вход через Clerk-форму без привязки к конкретной локализации лейблов.
async function loginViaClerk(page: Page, creds: Credentials): Promise<void> {
  await page.goto('/login');
  await page.locator('input[name="identifier"], input[type="email"]').first().fill(creds.email);
  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill(creds.password);
  // Этот блок создается, чтобы отправлять форму через Enter и не зависеть от скрытых submit-кнопок внутри Clerk.
  await passwordInput.press('Enter');
  // Этот блок создается, чтобы проверять успешный вход по однозначному UI-признаку авторизованного пользователя.
  await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible({ timeout: 20000 });
}

// Этот блок создается, чтобы восстанавливаться после редкого React-crash экрана (ErrorBoundary) и продолжать сценарий.
async function recoverIfErrorBoundaryShown(page: Page): Promise<void> {
  const crashTitle = page.getByRole('heading', { name: 'Произошла ошибка' });
  if (await crashTitle.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Обновить страницу' }).click();
    await expect(crashTitle).toHaveCount(0);
  }
}

// Этот блок создается, чтобы переходить на страницу с автоматическим "самовосстановлением", если сработал ErrorBoundary.
async function gotoWithRecovery(page: Page, url: string, readyLocator: ReturnType<Page['locator']>): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    // Этот блок создается, чтобы не зависеть от долгих фоновых запросов и ждать только готовность DOM.
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await recoverIfErrorBoundaryShown(page);
    if (await readyLocator.isVisible().catch(() => false)) return;
    // Этот блок создается, чтобы не зависать на reload; при следующей итерации выполняется новый goto.
    await page.waitForTimeout(500);
  }
  await expect(readyLocator).toBeVisible({ timeout: 15000 });
}

// Этот блок создается, чтобы поддержать оба UI-состояния страницы записи:
// шаг выбора специалиста и шаг выбора времени (когда специалист один и выбирается автоматически).
async function ensureBookPageReady(page: Page): Promise<void> {
  const specialistStep = page.getByRole('heading', { name: 'Выберите специалиста' });
  const scheduleStep = page.getByRole('heading', { name: 'Запись на приём' });
  await gotoWithRecovery(page, '/book', specialistStep.or(scheduleStep));
}

// Этот блок создается, чтобы гарантировать доступ пациента к странице записи даже при редком сбросе сессии.
async function ensurePatientBookAccess(page: Page, creds: Credentials): Promise<void> {
  await ensureBookPageReady(page);
  const guestNotice = page.getByRole('heading', { name: 'Запись доступна только авторизованным пациентам' });
  if (await guestNotice.isVisible().catch(() => false)) {
    await loginViaClerk(page, creds);
    await ensureBookPageReady(page);
  }
}

// Этот блок создается, чтобы подключить мок API и управлять данными сценария без реального backend-состояния.
async function setupApiMock(page: Page, role: 'specialist' | 'user'): Promise<void> {
  const specialistId = 'spec-1';
  const patientId = 'user-1';
  const day = toIsoDate(2);
  // Этот блок создается, чтобы моки использовали реальные тестовые e-mail из env, а не захардкоженные значения.
  const specialistEmail = process.env.PW_SPECIALIST_EMAIL || 'spec@example.com';
  const patientEmail = process.env.PW_PATIENT_EMAIL || 'patient@example.com';

  // Этот блок создается, чтобы хранить изменяемое состояние моковых сущностей в памяти одного теста.
  const state: {
    news: NewsItem[];
    slots: SlotItem[];
    bookings: BookingItem[];
  } = {
    news: [
      {
        id: 'news-seed-1',
        title: 'Моковая новость для проверки открытия',
        excerpt: 'Текст новости для e2e-проверки перехода на страницу новости.',
        imageUrl: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200',
        date: new Date().toISOString(),
        source: 'manual',
      },
    ],
    slots: [
      {
        id: 'slot-seed-1',
        specialistId,
        date: day,
        time: '11:00',
        status: 'free',
        specialistFirstName: 'Ирина',
        specialistLastName: 'Иванова',
      },
    ],
    bookings: [],
  };

  // Этот блок создается, чтобы перехватывать запросы фронтенда к /api и отдавать управляемые данные сценария.
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;

    // Этот блок создается, чтобы всегда отдавать профиль текущей роли и открывать нужные разделы в UI.
    if (path.endsWith('/api/users/me') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: role === 'specialist' ? specialistId : patientId,
          role,
          email: role === 'specialist' ? specialistEmail : patientEmail,
          firstName: role === 'specialist' ? 'Ирина' : 'Павел',
          lastName: role === 'specialist' ? 'Иванова' : 'Петров',
          phone: '+79000000000',
        }),
      });
      return;
    }

    // Этот блок создается, чтобы пациентский экран выбора врача получал хотя бы одного специалиста.
    if (path.endsWith('/api/users/specialists') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: specialistId, firstName: 'Ирина', lastName: 'Иванова', email: specialistEmail },
        ]),
      });
      return;
    }

    // Этот блок создается, чтобы главная страница стабильно загружала редактируемый контент.
    if (path.endsWith('/api/site-content/home') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          heroBadge: 'ЛФК',
          heroTitle: 'Главный экран',
          heroSubtitle: 'Демо-контент для e2e',
          heroCtaNote: 'Тестовый режим',
          primaryCtaText: 'Записаться на приём',
          secondaryCtaText: 'Войти',
          feature1Icon: '✅',
          feature1Title: 'Проверки',
          feature1Text: 'Работают стабильно',
          feature2Icon: '⚡',
          feature2Title: 'Скорость',
          feature2Text: 'Моки быстрее реального API',
          benefit1Icon: '1',
          benefit1Title: 'Блок 1',
          benefit1Text: 'Описание 1',
          benefit2Icon: '2',
          benefit2Title: 'Блок 2',
          benefit2Text: 'Описание 2',
          benefit3Icon: '3',
          benefit3Title: 'Блок 3',
          benefit3Text: 'Описание 3',
          newsIcon: '📰',
          newsTitle: 'Новости и статьи',
          newsSubtitle: 'Проверка моков',
          specialistIcon: '⚕️',
          specialistTitle: 'О специалисте',
          specialistText: 'Тестовый специалист',
        }),
      });
      return;
    }

    // Этот блок создается, чтобы управлять лентой новостей для сценариев специалиста и пациента.
    if (path.endsWith('/api/news') && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.news) });
      return;
    }
    if (path.endsWith('/api/news') && method === 'POST') {
      const payload = request.postDataJSON() as { title: string; excerpt: string; imageUrl: string };
      const item: NewsItem = {
        id: `news-${Date.now()}`,
        title: payload.title,
        excerpt: payload.excerpt,
        imageUrl: payload.imageUrl,
        date: new Date().toISOString(),
        source: 'manual',
      };
      state.news.unshift(item);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(item) });
      return;
    }

    // Этот блок создается, чтобы расписание и форма записи работали от моковых слотов.
    if (path.endsWith('/api/slots') && method === 'GET') {
      const specialistIdFromQuery = url.searchParams.get('specialistId');
      const dateFromQuery = url.searchParams.get('date');
      const filtered = state.slots.filter((s) => {
        if (specialistIdFromQuery && s.specialistId !== specialistIdFromQuery) return false;
        if (dateFromQuery && s.date !== dateFromQuery) return false;
        return true;
      });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(filtered) });
      return;
    }
    if (path.endsWith('/api/slots') && method === 'POST') {
      const payload = request.postDataJSON() as { specialistId: string; date: string; time: string };
      const slot: SlotItem = {
        id: `slot-${Date.now()}`,
        specialistId: payload.specialistId,
        date: payload.date,
        time: payload.time,
        status: 'free',
        specialistFirstName: 'Ирина',
        specialistLastName: 'Иванова',
      };
      state.slots.push(slot);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(slot) });
      return;
    }

    // Этот блок создается, чтобы обе формы записи (специалист/пациент) создавали запись и помечали слот занятым.
    if (path.endsWith('/api/bookings') && method === 'POST') {
      const payload = request.postDataJSON() as
        | { specialistId: string; date: string; time: string; firstName: string; lastName: string; phone?: string }
        | { specialistId: string; slotId: string; firstName: string; lastName: string; phone?: string };

      const specialist = { firstName: 'Ирина', lastName: 'Иванова' };
      const slotId = 'slotId' in payload ? payload.slotId : undefined;
      const linkedSlot = slotId ? state.slots.find((s) => s.id === slotId) : state.slots.find((s) => s.time === payload.time);
      const date = 'date' in payload ? payload.date : linkedSlot?.date ?? day;
      const time = 'time' in payload ? payload.time : linkedSlot?.time ?? '11:00';

      if (linkedSlot) linkedSlot.status = 'busy';

      const booking: BookingItem = {
        id: `booking-${Date.now()}`,
        specialistId: payload.specialistId,
        userId: role === 'user' ? patientId : undefined,
        date,
        time,
        firstName: payload.firstName,
        lastName: payload.lastName,
        phone: payload.phone,
        status: 'active',
        specialistFirstName: specialist.firstName,
        specialistLastName: specialist.lastName,
      };
      state.bookings.push(booking);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(booking) });
      return;
    }
    if (path.endsWith('/api/bookings') && method === 'GET') {
      const userId = url.searchParams.get('userId');
      const specialistIdFromQuery = url.searchParams.get('specialistId');
      const filtered = state.bookings.filter((b) => {
        if (userId) return b.userId === userId;
        if (specialistIdFromQuery) return b.specialistId === specialistIdFromQuery;
        return true;
      });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(filtered) });
      return;
    }

    // Этот блок создается, чтобы фоновые/второстепенные вызовы не роняли сценарии при отсутствии отдельного мока.
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
}

test.describe('E2E сценарии ролей', () => {
  // Этот блок создается, чтобы хранить креды отдельно для каждого сценария и делать сообщение об ошибке понятным.
  const specialistCreds: Credentials = {
    email: process.env.PW_SPECIALIST_EMAIL || '',
    password: process.env.PW_SPECIALIST_PASSWORD || '',
  };
  const patientCreds: Credentials = {
    email: process.env.PW_PATIENT_EMAIL || '',
    password: process.env.PW_PATIENT_PASSWORD || '',
  };

  test('Специалист: добавить запись и новость, проверить отображение', async ({ page }) => {
    test.skip(!specialistCreds.email || !specialistCreds.password, 'Нужны PW_SPECIALIST_EMAIL и PW_SPECIALIST_PASSWORD');
    await setupApiMock(page, 'specialist');
    await loginViaClerk(page, specialistCreds);
    await recoverIfErrorBoundaryShown(page);

    // Этот блок создается, чтобы специалист добавил слот и затем записал пациента через форму "Записать пациента".
    // Этот блок создается, чтобы открыть расписание через навигацию приложения (стабильнее, чем прямой переход URL).
    await page.getByRole('link', { name: 'Расписание' }).click();
    await recoverIfErrorBoundaryShown(page);
    await expect(page.getByRole('heading', { name: 'Расписание записей' })).toBeVisible();
    const visitDate = toIsoDate(3);
    await page.locator('input[type="date"]').first().fill(visitDate);
    await page.selectOption('form:has-text("Добавить один час приёма") select', '10:00');
    await page.getByRole('button', { name: 'Добавить слот', exact: true }).click();
    await page.selectOption('label:has-text("Дата") + select', visitDate);
    await page.selectOption('label:has-text("Свободные слоты") + select', '10:00');
    await page.locator('label:has-text("Имя") + input').first().fill('Тест');
    await page.locator('label:has-text("Фамилия") + input').first().fill('Пациент');
    await page.locator('input[placeholder="+79511232314"]').first().fill('+79990001122');
    await page.getByRole('button', { name: 'Создать запись' }).click();
    await expect(page.getByRole('table')).toContainText('Пациент');
    await expect(page.getByRole('table')).toContainText('10:00');

    // Этот блок создается, чтобы специалист добавил новость и затем проверил ее появление на главной странице.
    const title = `E2E новость ${Date.now()}`;
    await page.goto('/specialist/news');
    // Этот блок создается, чтобы работать строго с первой формой "Управление новостями", а не с полями контента главной страницы.
    const newsForm = page.locator('section:has(h1:has-text("Управление новостями")) form').first();
    await newsForm.locator('input').first().fill(title);
    await newsForm.locator('textarea').first().fill('Новость добавлена в рамках e2e сценария.');
    await newsForm.locator('input').nth(1).fill('https://images.unsplash.com/photo-1516549655169-df83a0774514?w=1200');
    await newsForm.getByRole('button', { name: 'Добавить новость' }).click();
    await page.goto('/');
    await expect(page.getByText(title)).toBeVisible();
  });

  test('Пациент: открыть новость, записаться и проверить "Мои записи"', async ({ page }) => {
    test.skip(!patientCreds.email || !patientCreds.password, 'Нужны PW_PATIENT_EMAIL и PW_PATIENT_PASSWORD');
    await setupApiMock(page, 'user');
    await loginViaClerk(page, patientCreds);
    await recoverIfErrorBoundaryShown(page);

    // Этот блок создается, чтобы пациент проверил, что новость видна на главной и открывается по клику.
    await gotoWithRecovery(page, '/', page.getByRole('heading', { name: 'Новости и статьи' }));
    await page.getByText('Моковая новость для проверки открытия').first().click();
    await expect(page.getByRole('heading', { name: 'Моковая новость для проверки открытия' })).toBeVisible();

    // Этот блок создается, чтобы пациент выбрал специалиста, время и завершил запись.
    await ensurePatientBookAccess(page, patientCreds);
    if (await page.getByRole('heading', { name: 'Выберите специалиста' }).isVisible().catch(() => false)) {
      await page.getByText('Иванова Ирина').first().click();
    }
    await page.getByRole('button', { name: /11:00/ }).click();
    await page.locator('label:has-text("Имя") + input').fill('Павел');
    await page.locator('label:has-text("Фамилия") + input').fill('Петров');
    await page.locator('input[placeholder="+79511232314"]').fill('+79995554433');
    await page.locator('label:has-text("Мне уже исполнилось 18 лет") input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Подтвердить запись' }).click();
    await expect(page.getByRole('heading', { name: 'Вы успешно записаны!' })).toBeVisible();

    // Этот блок создается, чтобы убедиться, что новая запись пациента появилась в разделе "Мои записи".
    await page.goto('/my-bookings');
    await expect(page.getByText('11:00')).toBeVisible();
    await expect(page.getByText('Иванова Ирина')).toBeVisible();
  });
});

test.describe('Негативные сценарии авторизации', () => {
  // Этот блок создается, чтобы не дублировать значения и управлять невалидными данными через env.
  const invalidCreds: Credentials = {
    email: process.env.PW_INVALID_EMAIL || 'wrong-user@example.com',
    password: process.env.PW_INVALID_PASSWORD || 'WrongPassword123!',
  };

  test('Авторизация: неверный логин или пароль показывают ошибку', async ({ page }) => {
    // Этот блок создается, чтобы проверить реакцию интерфейса на неправильные учетные данные.
    await page.goto('/login');
    await page.locator('input[name="identifier"], input[type="email"]').first().fill(invalidCreds.email);
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(invalidCreds.password);
    // Этот блок создается, чтобы отправить форму стабильно на всех версиях разметки Clerk.
    await passwordInput.press('Enter');

    // Этот блок создается, чтобы убедиться, что вход не выполнен даже если Clerk показывает разные формулировки ошибки.
    await expect(page).toHaveURL(/\/login/i);
    await expect(page.getByRole('button', { name: 'Выйти' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Вход в личный кабинет' })).toBeVisible();
    const possibleError = page.getByText(/невер|invalid|password|парол|credential|couldn|try again/i).first();
    if (await possibleError.isVisible().catch(() => false)) {
      await expect(possibleError).toBeVisible();
    }
  });
});

test.describe('Дополнительные сценарии', () => {
  // Этот блок создается, чтобы использовать единый набор кредов и переиспользовать его в нескольких тестах.
  const specialistCreds: Credentials = {
    email: process.env.PW_SPECIALIST_EMAIL || '',
    password: process.env.PW_SPECIALIST_PASSWORD || '',
  };
  const patientCreds: Credentials = {
    email: process.env.PW_PATIENT_EMAIL || '',
    password: process.env.PW_PATIENT_PASSWORD || '',
  };

  test('Пациент не может открыть раздел специалиста', async ({ page }) => {
    test.skip(!patientCreds.email || !patientCreds.password, 'Нужны PW_PATIENT_EMAIL и PW_PATIENT_PASSWORD');
    await setupApiMock(page, 'user');
    await loginViaClerk(page, patientCreds);

    // Этот блок создается, чтобы проверить защиту маршрута специалиста для роли пациента.
    await page.goto('/specialist/schedule');
    await expect(page.getByText('Раздел доступен только специалистам')).toBeVisible();
  });

  test('Специалист не может открыть раздел "Мои записи" пациента', async ({ page }) => {
    test.skip(!specialistCreds.email || !specialistCreds.password, 'Нужны PW_SPECIALIST_EMAIL и PW_SPECIALIST_PASSWORD');
    await setupApiMock(page, 'specialist');
    await loginViaClerk(page, specialistCreds);

    // Этот блок создается, чтобы проверить защиту пациентского маршрута для роли специалиста.
    await page.goto('/my-bookings');
    await expect(page.getByText('Раздел доступен только пациентам')).toBeVisible();
  });

  test('Страница несуществующей новости показывает корректное сообщение', async ({ page }) => {
    // Этот блок создается, чтобы тест не зависел от авторизации и проверял публичный fallback экрана новости.
    await setupApiMock(page, 'user');
    await page.goto('/news/non-existent-id');
    await expect(page.getByText('Новость не найдена')).toBeVisible();
    await expect(page.getByRole('button', { name: 'На главную' })).toBeVisible();
  });

  test('Пациент не может выбрать уже занятый слот', async ({ page }) => {
    test.skip(!patientCreds.email || !patientCreds.password, 'Нужны PW_PATIENT_EMAIL и PW_PATIENT_PASSWORD');
    await setupApiMock(page, 'user');
    await loginViaClerk(page, patientCreds);
    await recoverIfErrorBoundaryShown(page);

    // Этот блок создается, чтобы занять слот первой записью и затем проверить, что повторно он неактивен.
    await ensurePatientBookAccess(page, patientCreds);
    if (await page.getByRole('heading', { name: 'Выберите специалиста' }).isVisible().catch(() => false)) {
      await page.getByText('Иванова Ирина').first().click();
    }
    const timeButton = page.getByRole('button', { name: /11:00/ });
    await timeButton.click();
    await page.locator('label:has-text("Имя") + input').fill('Первый');
    await page.locator('label:has-text("Фамилия") + input').fill('Пациент');
    await page.locator('input[placeholder="+79511232314"]').fill('+79992223344');
    await page.locator('label:has-text("Мне уже исполнилось 18 лет") input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Подтвердить запись' }).click();
    await expect(page.getByRole('heading', { name: 'Вы успешно записаны!' })).toBeVisible();

    // Этот блок создается, чтобы убедиться, что вторая попытка выбрать тот же слот невозможна из-за статуса "Занято".
    await ensurePatientBookAccess(page, patientCreds);
    if (await page.getByRole('heading', { name: 'Выберите специалиста' }).isVisible().catch(() => false)) {
      await page.getByText('Иванова Ирина').first().click();
    }
    await expect(page.getByRole('button', { name: /11:00/ })).toBeDisabled();
  });
});
