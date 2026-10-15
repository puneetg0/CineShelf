from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import User, require_admin
from ..database import get_db
from ..models.db_models import MovieDB
from ..schemas.admin import AdminMovie, AdminUser

router = APIRouter(prefix="/admin", tags=["administration"])


@router.get("/users", response_model=list[AdminUser])
def get_users(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[User]:
    statement = select(User).order_by(User.id)
    return list(db.scalars(statement).all())


@router.get("/movies", response_model=list[AdminMovie])
def get_all_movies(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    statement = (
        select(MovieDB, User.email)
        .outerjoin(User, MovieDB.owner_id == User.id)
        .order_by(MovieDB.id)
    )
    return [
        {
            "id": movie.id,
            "title": movie.title,
            "genre": movie.genre,
            "release_year": movie.release_year,
            "rating": movie.rating,
            "watched": movie.watched,
            "poster_url": movie.poster_url,
            "owner_id": movie.owner_id,
            "owner_email": owner_email,
        }
        for movie, owner_email in db.execute(statement).all()
    ]
