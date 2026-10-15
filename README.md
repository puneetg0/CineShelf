# CineShelf  Live- https://cineshelf-frontend-5qiq.onrender.com/

A full-stack movie collection manager. Add films to your personal library, track what you've watched, filter by genre, and manage everything through a clean web interface.

Live demo: deploy your own instance in minutes using the included `render.yaml` blueprint.

---

## What it does

- Register and sign in with email and password
- Add movies with a title, genre, release year, rating (0–10), and an optional poster image URL
- Mark movies as watched or unwatched
- Search movies by title and filter by genre
- View a watchlist of films you haven't seen yet
- Admin accounts can view all users and every movie in the database

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS v4 |
| Backend | Python, FastAPI, Uvicorn |
| Database | PostgreSQL (via SQLAlchemy 2 + psycopg v3) |
| Auth | Hand-rolled HS256 JWT, PBKDF2-SHA256 password hashing |
| Deployment | Render (blueprint in `render.yaml`) |

---

## Project structure

```
CineShelf/
├── backend/
│   ├── .env                  # local secrets (not committed)
│   ├── requirements.txt
│   └── app/
│       ├── main.py           # FastAPI app, CORS, router wiring
│       ├── auth.py           # JWT logic, password hashing, /auth routes
│       ├── database.py       # SQLAlchemy engine and session
│       ├── models/
│       │   └── db_models.py  # MovieDB table
│       ├── routes/
│       │   ├── movie.py      # CRUD endpoints for movies
│       │   └── admin.py      # Admin-only user and movie views
│       └── schemas/
│           ├── movie.py      # Pydantic request/response models
│           └── admin.py      # Admin response models
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── App.jsx           # Auth flow, API helper, login form
│       ├── main.jsx
│       ├── components/
│       │   └── MovieCard.jsx # Reusable movie card component
│       ├── features/
│       │   └── library/
│       │       └── MovieLibrary.jsx  # Main dashboard, filters, CRUD
│       └── styles/
│           ├── index.css
│           ├── auth.css
│           └── library.css
├── render.yaml               # Render deployment blueprint
└── tests/
    └── test_practice.py
```

---

## Running locally

### Prerequisites

- Python 3.11+
- Node.js 20+
- A running PostgreSQL database

### Backend

```powershell
cd backend
Copy-Item .env.example .env
```

Edit `.env` and set the two required values:

```
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/cineshelf
JWT_SECRET_KEY=<random string, at least 32 characters>
```

Then install dependencies and start the API:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`.  
Interactive docs are at `http://localhost:8000/docs`.

Tables are created automatically on first startup — no migration step needed.

### Frontend

Open a second terminal:

```powershell
cd frontend
npm ci
npm run dev
```

The app runs at `http://localhost:5173`. It connects to `http://localhost:8000` by default. To point it at a different backend, create `frontend/.env.local`:

```
VITE_API_URL=http://your-backend-host
```

---

## API overview

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/register` | Create a new account |
| `POST` | `/auth/login` | Get a JWT access token |
| `GET` | `/auth/me` | Get the current user's profile |
| `GET` | `/movies` | List your movies (supports `search` and `genre` query params) |
| `POST` | `/movies` | Add a movie |
| `PUT` | `/movies/{id}` | Update a movie |
| `PATCH` | `/movies/{id}/watched` | Toggle watched status |
| `DELETE` | `/movies/{id}` | Delete a movie |
| `GET` | `/genres` | List distinct genres in your library |
| `GET` | `/admin/users` | (admin only) List all users |
| `GET` | `/admin/movies` | (admin only) List all movies with owner info |
| `GET` | `/health` | Health check |

All movie endpoints require a `Authorization: Bearer <token>` header.

---

## Deploying to Render

The repo includes a `render.yaml` blueprint that sets up a PostgreSQL database, the FastAPI backend, and the React static site in one click.

1. Push the repo to GitHub
2. Go to [render.com](https://render.com) → **New** → **Blueprint** → connect your repo
3. Render will create all three resources automatically

Two environment variables need to be filled in manually after the first deploy (they depend on each other's URLs):

| Service | Key | Value |
|---|---|---|
| `cineshelf-api` | `CORS_ORIGINS` | Your frontend URL, e.g. `https://cineshelf-frontend.onrender.com` |
| `cineshelf-frontend` | `VITE_API_URL` | Your backend URL, e.g. `https://cineshelf-api.onrender.com` |

**Important:** After setting `VITE_API_URL`, trigger a manual redeploy of the frontend — Vite bakes this value in at build time.

**Database URL note:** Render auto-fills `DATABASE_URL` from the managed Postgres instance. You may need to change the scheme from `postgresql://` to `postgresql+psycopg://` in the Render dashboard to match the psycopg v3 driver this project uses.

`JWT_SECRET_KEY` is auto-generated by Render via `generateValue: true`.

> Free tier services spin down after 15 minutes of inactivity. The first request after a cold start takes roughly 30 seconds.

---

## Environment variables

### Backend

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (`postgresql+psycopg://...`) |
| `JWT_SECRET_KEY` | Yes | Random secret, minimum 32 characters |
| `CORS_ORIGINS` | Production | Comma-separated list of allowed frontend origins |

### Frontend

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Base URL of the backend API |
