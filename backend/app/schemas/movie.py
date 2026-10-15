from typing import Optional
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator


class MovieFields(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    genre: str = Field(min_length=1, max_length=40)
    release_year: int = Field(ge=1888, le=2100)
    rating: float = Field(ge=0, le=10)
    watched: bool = False
    poster_url: Optional[str] = Field(default=None, max_length=2048)

    @field_validator("title", "genre")
    @classmethod
    def trim_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank")
        return value

    @field_validator("poster_url")
    @classmethod
    def validate_poster_url(cls, value: str | None) -> str | None:
        if value is None:
            return None

        value = value.strip()
        if not value:
            return None

        try:
            parsed_url = urlsplit(value)
            valid_url = (
                parsed_url.scheme in {"http", "https"}
                and bool(parsed_url.netloc)
                and bool(parsed_url.hostname)
            )
        except ValueError:
            valid_url = False
        if not valid_url:
            raise ValueError("Enter a valid HTTP or HTTPS URL.")
        return value


class WatchedUpdate(BaseModel):
    watched: bool


class Movie(MovieFields):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: Optional[int] = None