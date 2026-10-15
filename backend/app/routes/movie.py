from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi import Path
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import User, get_current_user
from ..database import get_db
from ..models.db_models import MovieDB
from ..schemas.movie import Movie, MovieFields, WatchedUpdate

router = APIRouter()


def visible_to_user(user_id: int):
    return MovieDB.owner_id == user_id


@router.get("/genres", response_model=list[str])
def get_genres(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[str]:
    statement = (
        select(MovieDB.genre)
        .where(visible_to_user(current_user.id))
        .distinct()
        .order_by(MovieDB.genre)
    )
    return list(db.scalars(statement).all())


@router.get("/movies", response_model=list[Movie])
def get_movies(
    search: str = Query(default="", max_length=120),
    genre: str = Query(default="", max_length=40),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MovieDB]:
    statement = (
        select(MovieDB)
        .where(visible_to_user(current_user.id))
        .order_by(MovieDB.id)
    )

    if search:
        statement = statement.where(MovieDB.title.ilike(f"%{search}%"))

    if genre:
        statement = statement.where(MovieDB.genre.ilike(genre))

    return list(db.scalars(statement).all())


@router.get("/movies/{movie_id}", response_model=Movie)
def get_movie(
    movie_id: Annotated[int, Path(ge=1)],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MovieDB:
    movie = db.scalar(
        select(MovieDB).where(
            MovieDB.id == movie_id,
            visible_to_user(current_user.id),
        )
    )
    if movie is None:
        raise HTTPException(status_code=404, detail="Movie not found")
    return movie


@router.post("/movies", response_model=Movie, status_code=status.HTTP_201_CREATED)
def create_movie(
    movie_fields: MovieFields,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MovieDB:
    movie = MovieDB(**movie_fields.model_dump(), owner_id=current_user.id)
    db.add(movie)
    db.commit()
    db.refresh(movie)
    return movie


@router.put("/movies/{movie_id}", response_model=Movie)
def update_movie(
    movie_id: Annotated[int, Path(ge=1)],
    movie_fields: MovieFields,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MovieDB:
    movie = db.scalar(
        select(MovieDB).where(
            MovieDB.id == movie_id,
            MovieDB.owner_id == current_user.id,
        )
    )
    if movie is None:
        raise HTTPException(status_code=404, detail="Movie not found")
    for field, value in movie_fields.model_dump().items():
        setattr(movie, field, value)
    db.commit()
    db.refresh(movie)
    return movie


@router.patch("/movies/{movie_id}/watched", response_model=Movie)
def update_watched_status(
    movie_id: Annotated[int, Path(ge=1)],
    update: WatchedUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MovieDB:
    movie = db.scalar(
        select(MovieDB).where(
            MovieDB.id == movie_id,
            MovieDB.owner_id == current_user.id,
        )
    )
    if movie is None:
        raise HTTPException(status_code=404, detail="Movie not found")
    movie.watched = update.watched
    db.commit()
    db.refresh(movie)
    return movie


@router.delete("/movies/{movie_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_movie(
    movie_id: Annotated[int, Path(ge=1)],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    movie = db.scalar(
        select(MovieDB).where(
            MovieDB.id == movie_id,
            MovieDB.owner_id == current_user.id,
        )
    )
    if movie is None:
        raise HTTPException(status_code=404, detail="Movie not found")
    db.delete(movie)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
