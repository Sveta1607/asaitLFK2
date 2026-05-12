/**
 * Этот модуль создаётся, чтобы по тексту сообщения понять, что пользователь спрашивает именно про новости
 * (до выбора источника: сайт центра или интернет).
 */

/**
 * Этот блок задаёт «начало слова» для кириллицы: в JS \b видит только ASCII-буквы, поэтому «новости» не совпадало с \\bновост.
 */
function startsCyrillicWord(haystack, needle) {
  const h = haystack.toLowerCase();
  const n = needle.toLowerCase();
  let pos = 0;
  while (pos <= h.length) {
    const i = h.indexOf(n, pos);
    if (i < 0) {
      return false;
    }
    const prev = i === 0 ? "" : h[i - 1];
    const isWordChar = /[0-9A-Za-zА-Яа-яЁё]/.test(prev);
    if (!isWordChar) {
      return true;
    }
    pos = i + 1;
  }
  return false;
}

/**
 * Этот блок проверяет типичные формулировки про новости и анонсы (без срабатывания на любое слово «новый»).
 */
export function isNewsRelatedQuestion(text) {
  const t = (text || "").trim();
  if (t.length < 4) {
    return false;
  }
  return (
    startsCyrillicWord(t, "новост") ||
    /что\s+нового/i.test(t) ||
    /что\s+новеньк/i.test(t) ||
    startsCyrillicWord(t, "анонс") ||
    /последн(ие|их)\s+новост/i.test(t) ||
    /есть\s+ли\s+новост/i.test(t) ||
    /расскаж(ите|и)\s+про\s+новост/i.test(t)
  );
}

/**
 * Этот блок угадывает выбор источника, если пользователь ответил текстом вместо кнопки.
 */
export function interpretNewsSourceReply(text) {
  const t = (text || "").trim().toLowerCase();
  if (!t) {
    return null;
  }
  const wantsNet =
    /(^|[^а-яё])интернет/i.test(t) ||
    /(^|[^а-яё])онлайн/i.test(t) ||
    /в\s+сети/i.test(t) ||
    /открыт(ых|ые)\s+источник/i.test(t) ||
    /из\s+интернета/i.test(t);
  const wantsSite =
    /(^|[^а-яё])сайт/i.test(t) ||
    /(^|[^а-яё])центр/i.test(t) ||
    /(^|[^а-яё])клиник/i.test(t) ||
    /(^|[^а-яё])официальн/i.test(t) ||
    /на\s+сайте/i.test(t);

  if (wantsNet && !wantsSite) {
    return "internet";
  }
  if (wantsSite && !wantsNet) {
    return "site";
  }
  if (wantsNet && wantsSite) {
    return null;
  }
  if (wantsNet) {
    return "internet";
  }
  if (wantsSite) {
    return "site";
  }
  return null;
}
