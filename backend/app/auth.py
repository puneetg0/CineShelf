import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import String, inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Mapped, Session, mapped_column

if __package__:
    from .database import engine, get_db
    from .models.db_models import Base
else:
    from database import engine, get_db
    from models.db_models import Base


load_dotenv(Path(__file__).resolve().parents[1] / ".env")

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "")
if len(JWT_SECRET_KEY) < 32:
    raise RuntimeError(
        "Set JWT_SECRET_KEY to a random value at least 32 characters long "
        "before starting the CineShelf API."
    )

ACCESS_TOKEN_MINUTES = 30
PASSWORD_HASH_ITERATIONS = 600_000
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
unauthorized = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid or expired access token.",
    headers={"WWW-Authenticate": "Bearer"},
)
bearer_scheme = HTTPBearer(auto_error=False)
router = APIRouter(prefix="/auth", tags=["authentication"])


AuthBase = Base


class User(Base):
    __tablename__ = "day13_users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(
        String(20), nullable=False, default="user", server_default="user"
    )


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, email: str) -> str:
        normalized_email = email.strip().lower()
        if not EMAIL_PATTERN.fullmatch(normalized_email):
            raise ValueError("Enter a valid email address.")
        return normalized_email


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    role: str


def encode_part(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def decode_part(value: str) -> bytes:
    padded_value = value + "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(padded_value.encode("ascii"))


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_HASH_ITERATIONS,
    )
    return (
        f"pbkdf2_sha256${PASSWORD_HASH_ITERATIONS}"
        f"${encode_part(salt)}${encode_part(digest)}"
    )


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt_text, digest_text = stored_hash.split("$")
        if algorithm != "pbkdf2_sha256":
            return False

        iterations = int(iterations_text)
        salt = decode_part(salt_text)
        expected_digest = decode_part(digest_text)
    except (ValueError, UnicodeError):
        return False

    if (
        iterations <= 0
        or len(salt) != 16
        or len(expected_digest) != hashlib.sha256().digest_size
    ):
        return False

    actual_digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
    )
    return hmac.compare_digest(actual_digest, expected_digest)


def create_access_token(email: str) -> str:
    now = int(time.time())
    expires_at = now + ACCESS_TOKEN_MINUTES * 60
    header = encode_part(json.dumps({"alg": "HS256", "typ": "JWT"}).encode("utf-8"))
    payload = encode_part(
        json.dumps(
            {"sub": email, "iat": now, "exp": expires_at},
            separators=(",", ":"),
        ).encode("utf-8")
    )
    signing_input = f"{header}.{payload}"
    signature = hmac.new(
        JWT_SECRET_KEY.encode("utf-8"),
        signing_input.encode("ascii"),
        hashlib.sha256,
    ).digest()
    return f"{signing_input}.{encode_part(signature)}"


def get_token_email(token: str) -> str:
    try:
        header_part, payload_part, signature_part = token.split(".")
        signing_input = f"{header_part}.{payload_part}"
        expected_signature = hmac.new(
            JWT_SECRET_KEY.encode("utf-8"),
            signing_input.encode("ascii"),
            hashlib.sha256,
        ).digest()
        if not hmac.compare_digest(expected_signature, decode_part(signature_part)):
            raise ValueError("Invalid token signature.")

        header = json.loads(decode_part(header_part))
        payload = json.loads(decode_part(payload_part))
        if not isinstance(header, dict) or not isinstance(payload, dict):
            raise ValueError("Invalid token structure.")
        if header.get("alg") != "HS256":
            raise ValueError("Unsupported token algorithm.")

        email = payload.get("sub")
        expires_at = payload.get("exp")
        if not isinstance(email, str) or type(expires_at) is not int:
            raise ValueError("Invalid token claims.")
        if expires_at <= int(time.time()):
            raise ValueError("Token has expired.")
        return email
    except (ValueError, UnicodeError, json.JSONDecodeError) as error:
        raise unauthorized from error


def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credentials is None:
        raise unauthorized

    email = get_token_email(credentials.credentials)
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        raise unauthorized
    return user


def require_admin(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access is required.",
        )
    return user


def assign_legacy_movies_to_first_user(db: Session, user_id: int) -> None:
    first_user_id = db.scalar(select(User.id).order_by(User.id).limit(1))
    if first_user_id != user_id:
        return

    inspector = inspect(db.connection())
    if "movies" not in inspector.get_table_names():
        return

    movie_columns = {
        column["name"] for column in inspector.get_columns("movies")
    }
    if "owner_id" not in movie_columns:
        return

    db.execute(
        text(
            "UPDATE movies SET owner_id = :owner_id "
            "WHERE owner_id IS NULL"
        ),
        {"owner_id": user_id},
    )


@asynccontextmanager
async def lifespan(_: FastAPI):
    AuthBase.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="CineShelf Day 13 Auth API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    credentials: Credentials,
    db: Annotated[Session, Depends(get_db)],
) -> User:
    user = User(
        email=credentials.email,
        password_hash=hash_password(credentials.password),
    )
    db.add(user)
    try:
        db.flush()
        assign_legacy_movies_to_first_user(db, user.id)
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from error

    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(
    credentials: Credentials,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    user = db.scalar(select(User).where(User.email == credentials.email))
    if user is None or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email or password is incorrect.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return TokenResponse(
        access_token=create_access_token(user.email),
        expires_in=ACCESS_TOKEN_MINUTES * 60,
    )


@router.get("/me", response_model=UserResponse)
def read_current_user(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    return user
