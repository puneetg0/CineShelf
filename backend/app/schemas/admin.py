from pydantic import BaseModel

from .movie import Movie


class AdminUser(BaseModel):
    id: int
    email: str
    role: str


class AdminMovie(Movie):
    owner_email: str | None = None
