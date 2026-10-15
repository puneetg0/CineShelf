from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Identity, Integer, Numeric, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class MovieDB(Base):
    __tablename__ = "movies"

    id: Mapped[int] = mapped_column(
        Integer, Identity(always=True), primary_key=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    genre: Mapped[str] = mapped_column(String(80), nullable=False)
    release_year: Mapped[int] = mapped_column(Integer, nullable=False)
    rating: Mapped[Decimal] = mapped_column(Numeric(3, 1), nullable=False)
    watched: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    poster_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_id: Mapped[int | None] = mapped_column(
        ForeignKey("day13_users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )