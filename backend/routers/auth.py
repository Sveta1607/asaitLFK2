# routers/auth.py — эндпоинты авторизации (login, register)
from fastapi import APIRouter, HTTPException, Body
from store import users
from models import UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def _validate_auth(data: dict) -> list[dict]:
    """Валидирует обязательные поля, возвращает список ошибок или пустой список"""
    errors = []
    email = str(data.get("email") or "").strip()
    firstName = str(data.get("firstName") or "").strip()
    lastName = str(data.get("lastName") or "").strip()
    role = data.get("role") if data.get("role") in ("user", "specialist") else "user"
    phone = str(data.get("phone") or "").strip()
    if not email:
        errors.append({"field": "email", "message": "E-mail обязателен"})
    if not firstName:
        errors.append({"field": "firstName", "message": "Имя обязательно"})
    if not lastName:
        errors.append({"field": "lastName", "message": "Фамилия обязательна"})
    if role == "user" and not phone:
        errors.append({"field": "phone", "message": "Телефон обязателен для пациентов"})
    return errors


@router.post("/login", response_model=UserResponse)
def login(body: dict = Body(...)):
    """Вход: валидация полей, поиск/создание пользователя по email+role"""
    errs = _validate_auth(body)
    if errs:
        raise HTTPException(
            status_code=400,
            detail={
                "detail": "Пожалуйста, заполните все обязательные поля.",
                "code": "VALIDATION_ERROR",
                "errors": errs,
            },
        )
    return _auth_impl(body)


@router.post("/register", response_model=UserResponse)
def register(body: dict = Body(...)):
    """Регистрация: то же, что и login (упрощённая авторизация)"""
    errs = _validate_auth(body)
    if errs:
        raise HTTPException(
            status_code=400,
            detail={
                "detail": "Пожалуйста, заполните все обязательные поля.",
                "code": "VALIDATION_ERROR",
                "errors": errs,
            },
        )
    return _auth_impl(body)


def _auth_impl(data: dict) -> UserResponse:
    """Общая логика: ищем по email+role или создаём нового"""
    email = (data.get("email") or "").strip()
    role = data.get("role") if data.get("role") in ("user", "specialist") else "user"
    firstName = (data.get("firstName") or "").strip()
    lastName = (data.get("lastName") or "").strip()
    phone = (data.get("phone") or "").strip() if role == "user" else None
    # Для демо: один пациент u1, один специалист spec1
    for uid, u in users.items():
        if u.get("email") == email and u.get("role") == role:
            return UserResponse(**u)
    # Создаём нового (для регистрации)
    new_id = f"u-{len(users) + 1}" if role == "user" else f"spec-{len([x for x in users.values() if x.get('role') == 'specialist']) + 1}"
    user_data = {
        "id": new_id,
        "role": role,
        "email": email,
        "firstName": firstName,
        "lastName": lastName,
        "phone": phone,
    }
    users[new_id] = user_data
    return UserResponse(**user_data)
