from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import AuthBase, router as auth_router
from .database import engine
from .routes.admin import router as admin_router
from .routes.movie import router as movie_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    AuthBase.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="CineShelf API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(movie_router)
app.include_router(admin_router)
app.include_router(auth_router)
