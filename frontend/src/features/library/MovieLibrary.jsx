import { useEffect, useState } from 'react'
import MovieCard from '../../components/MovieCard.jsx'
import '../../styles/library.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function authorizedFetch(url, accessToken, options = {}, onUnauthorized) {
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)
  let response
  try {
    response = await fetch(url, { ...options, headers })
  } catch (requestError) {
    if (requestError.name === 'AbortError') throw requestError
    throw new Error('Could not connect to CineShelf. Check that the backend is running.')
  }

  if (response.status === 401) {
    onUnauthorized()
    const error = new Error('Your session has expired. Please sign in again.')
    error.status = 401
    throw error
  }

  return response
}

async function readResponseData(response) {
  if (response.status === 204) return null
  try {
    return await response.json()
  } catch {
    return null
  }
}

function createResponseError(response, result, fallback) {
  const detail = result?.detail
  const error = new Error(
    typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? 'Some movie details are invalid. Please review the form.'
        : response.status >= 500
          ? 'CineShelf could not complete that request. Please try again.'
          : fallback,
  )
  error.status = response.status

  if (Array.isArray(detail)) {
    error.fieldErrors = {}
    for (const issue of detail) {
      const field = issue.loc?.at(-1)
      if (['title', 'genre', 'release_year', 'rating', 'poster_url'].includes(field)) {
        error.fieldErrors[field] ??= issue.msg
      }
    }
  }
  return error
}

const pages = [
  { id: 'home', label: 'Home' },
  { id: 'movies', label: 'All Movies' },
  { id: 'watchlist', label: 'To Watch' },
]

function MovieForm({ movie, onSave, onClose }) {
  const [form, setForm] = useState(() => movie ? {
    title: movie.title,
    genre: movie.genre,
    release_year: movie.release_year,
    rating: movie.rating,
    watched: movie.watched,
    poster_url: movie.poster_url ?? '',
  } : {
    title: '',
    genre: '',
    release_year: new Date().getFullYear(),
    rating: 7,
    watched: false,
    poster_url: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  function updateField(event) {
    const { name, value, checked, type } = event.target
    setForm((currentForm) => ({
      ...currentForm,
      [name]: type === 'checkbox' ? checked : value,
    }))
    setFieldErrors((currentErrors) => {
      const nextErrors = { ...currentErrors }
      delete nextErrors[name]
      return nextErrors
    })
    setFormError('')
  }

  function validateForm() {
    const errors = {}
    const title = form.title.trim()
    const genre = form.genre.trim()
    const year = Number(form.release_year)
    const rating = Number(form.rating)

    if (!title) errors.title = 'Enter a movie title.'
    else if (title.length > 120) errors.title = 'Movie title must be 120 characters or fewer.'
    if (!genre) errors.genre = 'Enter a movie genre.'
    else if (genre.length > 40) errors.genre = 'Genre must be 40 characters or fewer.'
    if (form.release_year === '' || !Number.isInteger(year) || year < 1888 || year > 2100) {
      errors.release_year = 'Enter a whole year between 1888 and 2100.'
    }
    if (form.rating === '' || !Number.isFinite(rating) || rating < 0 || rating > 10) {
      errors.rating = 'Enter a rating from 0 to 10.'
    }

    const posterUrl = form.poster_url.trim()
    if (posterUrl) {
      try {
        const parsedUrl = new URL(posterUrl)
        if (!['http:', 'https:'].includes(parsedUrl.protocol) || !parsedUrl.hostname) {
          errors.poster_url = 'Enter a valid HTTP or HTTPS URL.'
        }
      } catch {
        errors.poster_url = 'Enter a valid HTTP or HTTPS URL.'
      }
      if (posterUrl.length > 2048) errors.poster_url = 'Poster URL must be 2048 characters or fewer.'
    }
    return errors
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const errors = validateForm()
    setFieldErrors(errors)
    setFormError('')
    if (Object.keys(errors).length > 0) return

    setIsSaving(true)

    try {
      await onSave(movie?.id, {
        ...form,
        title: form.title.trim(),
        genre: form.genre.trim(),
        release_year: Number(form.release_year),
        rating: Number(form.rating),
        poster_url: form.poster_url.trim() || null,
      })
      onClose()
    } catch (saveError) {
      setFieldErrors(saveError.fieldErrors ?? {})
      setFormError(saveError.fieldErrors && Object.keys(saveError.fieldErrors).length > 0
        ? 'Please review the highlighted fields.'
        : saveError.message || 'Could not save this movie. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-backdrop fixed inset-0 z-10 grid place-items-center overflow-y-auto bg-black/70 p-3 sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-panel w-full max-w-[520px] rounded bg-white p-4 shadow-2xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="movie-form-title">
        <div className="modal-heading mb-5 flex items-start justify-between">
          <div>
            <p className="eyebrow">YOUR LIBRARY</p>
            <h2 className="m-0 font-display text-2xl font-normal text-ink" id="movie-form-title">{movie ? 'Edit movie' : 'Add a movie'}</h2>
          </div>
          <button className="close-button grid size-[34px] place-items-center rounded border-0 bg-[#e9ece7] text-2xl leading-none text-ink hover:bg-[#dce1da]" type="button" onClick={onClose} aria-label="Close form">×</button>
        </div>
        <form className="movie-form grid grid-cols-1 gap-3 sm:grid-cols-2" noValidate onSubmit={handleSubmit}>
          <label className="form-field flex min-w-0 flex-col gap-1.5 text-[11px] font-extrabold text-[#44514b] sm:col-span-2">
            <span>Movie title</span>
            <input aria-describedby={fieldErrors.title ? 'movie-title-error' : undefined} aria-invalid={Boolean(fieldErrors.title)} className="h-[39px] w-full rounded border border-line bg-[#f7f8f4] px-2.5 text-xs text-ink focus:border-teal focus:outline-none" name="title" value={form.title} onChange={updateField} required maxLength="120" autoFocus />
            {fieldErrors.title && <span className="field-error" id="movie-title-error">{fieldErrors.title}</span>}
          </label>
          <label className="form-field flex min-w-0 flex-col gap-1.5 text-[11px] font-extrabold text-[#44514b]">
            <span>Genre</span>
            <input aria-describedby={fieldErrors.genre ? 'movie-genre-error' : undefined} aria-invalid={Boolean(fieldErrors.genre)} className="h-[39px] w-full rounded border border-line bg-[#f7f8f4] px-2.5 text-xs text-ink focus:border-teal focus:outline-none" name="genre" value={form.genre} onChange={updateField} placeholder="e.g. Adventure" required maxLength="40" />
            {fieldErrors.genre && <span className="field-error" id="movie-genre-error">{fieldErrors.genre}</span>}
          </label>
          <label className="form-field flex min-w-0 flex-col gap-1.5 text-[11px] font-extrabold text-[#44514b]">
            <span>Release year</span>
            <input aria-describedby={fieldErrors.release_year ? 'movie-year-error' : undefined} aria-invalid={Boolean(fieldErrors.release_year)} className="h-[39px] w-full rounded border border-line bg-[#f7f8f4] px-2.5 text-xs text-ink focus:border-teal focus:outline-none" name="release_year" type="number" min="1888" max="2100" step="1" value={form.release_year} onChange={updateField} required />
            {fieldErrors.release_year && <span className="field-error" id="movie-year-error">{fieldErrors.release_year}</span>}
          </label>
          <label className="form-field flex min-w-0 flex-col gap-1.5 text-[11px] font-extrabold text-[#44514b]">
            <span>Rating out of 10</span>
            <input aria-describedby={fieldErrors.rating ? 'movie-rating-error' : undefined} aria-invalid={Boolean(fieldErrors.rating)} className="h-[39px] w-full rounded border border-line bg-[#f7f8f4] px-2.5 text-xs text-ink focus:border-teal focus:outline-none" name="rating" type="number" min="0" max="10" step="0.1" value={form.rating} onChange={updateField} required />
            {fieldErrors.rating && <span className="field-error" id="movie-rating-error">{fieldErrors.rating}</span>}
          </label>
          <label className="form-field flex min-w-0 flex-col gap-1.5 text-[11px] font-extrabold text-[#44514b] sm:col-span-2">
            <span>Poster image URL <small className="ml-1 text-[10px] font-medium text-[#89918c]">Optional</small></span>
            <input aria-describedby={fieldErrors.poster_url ? 'movie-poster-error' : undefined} aria-invalid={Boolean(fieldErrors.poster_url)} className="h-[39px] w-full rounded border border-line bg-[#f7f8f4] px-2.5 text-xs text-ink focus:border-teal focus:outline-none" name="poster_url" type="url" value={form.poster_url} onChange={updateField} placeholder="https://..." />
            {fieldErrors.poster_url && <span className="field-error" id="movie-poster-error">{fieldErrors.poster_url}</span>}
          </label>
          <label className="watched-field flex items-center gap-2 text-[11px] text-[#44514b] sm:col-span-2">
            <input className="size-4 accent-teal" name="watched" type="checkbox" checked={form.watched} onChange={updateField} />
            <span>I've watched this movie</span>
          </label>
          {formError && <p className="form-error m-0 text-xs text-[#a43e31] sm:col-span-2" role="alert">{formError}</p>}
          <div className="form-actions flex justify-end gap-2 pt-1 sm:col-span-2">
            <button className="cancel-button min-h-[37px] rounded border-0 bg-[#e8ebe5] px-3 text-[11px] font-extrabold text-ink hover:bg-[#dce1da]" type="button" onClick={onClose}>Cancel</button>
            <button className="submit-button min-h-[37px] rounded border-0 bg-coral px-3 text-[11px] font-extrabold text-white transition-colors hover:bg-[#be402d] disabled:cursor-wait disabled:opacity-65" type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : movie ? 'Save changes' : 'Add to collection'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function App({ accessToken, user, onLogout }) {
  const [movies, setMovies] = useState([])
  const [activePage, setActivePage] = useState('home')
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingMovie, setEditingMovie] = useState(null)
  const [search, setSearch] = useState('')
  const [genre, setGenre] = useState('All')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)

  useEffect(() => {
    const controller = new AbortController()

    authorizedFetch(`${API_URL}/movies`, accessToken, { signal: controller.signal }, onLogout)
      .then(async (response) => {
        const result = await readResponseData(response)
        if (!response.ok) throw createResponseError(response, result, 'Could not load your movies.')
        return result
      })
      .then((result) => {
        if (!Array.isArray(result)) {
          throw new Error('The server returned an unexpected movie list. Please refresh the page.')
        }
        setMovies(result)
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError' && requestError.status !== 401) {
          setError(requestError.message || 'Could not load your movies. Please try again.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })

    return () => controller.abort()
  }, [accessToken, onLogout])

  const genres = ['All', ...new Set(movies.map((movie) => movie.genre))]
  const toWatchCount = movies.filter((movie) => !movie.watched).length
  const visibleMovies = movies.filter((movie) => {
    const matchesPage = activePage !== 'watchlist' || !movie.watched
    const matchesSearch = movie.title.toLowerCase().includes(search.toLowerCase())
    const matchesGenre = genre === 'All' || movie.genre === genre

    return matchesPage && matchesSearch && matchesGenre
  })

  async function toggleWatched(movie) {
    setUpdatingId(movie.id)
    setError('')

    try {
      const response = await authorizedFetch(`${API_URL}/movies/${movie.id}/watched`, accessToken, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watched: !movie.watched }),
      }, onLogout)
      const result = await readResponseData(response)
      if (!response.ok) throw createResponseError(response, result, 'Could not update this movie.')
      if (!result || typeof result !== 'object') {
        throw new Error('The server returned an unexpected response. Please try again.')
      }

      const updatedMovie = result
      setMovies((currentMovies) => currentMovies.map((item) => (
        item.id === updatedMovie.id ? updatedMovie : item
      )))
    } catch (requestError) {
      if (requestError.status !== 401) setError(requestError.message)
    } finally {
      setUpdatingId(null)
    }
  }

  async function saveMovie(movieId, movieData) {
    const response = await authorizedFetch(movieId === undefined ? `${API_URL}/movies` : `${API_URL}/movies/${movieId}`, accessToken, {
      method: movieId === undefined ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(movieData),
    }, onLogout)
    const result = await readResponseData(response)

    if (!response.ok) {
      const action = movieId === undefined ? 'add' : 'update'
      throw createResponseError(response, result, `Could not ${action} this movie.`)
    }
    if (!result || typeof result !== 'object') {
      throw new Error('The server returned an unexpected response. Please try again.')
    }

    setMovies((currentMovies) => movieId === undefined
      ? [...currentMovies, result]
      : currentMovies.map((movie) => movie.id === result.id ? result : movie))
    if (movieId === undefined) {
      setActivePage('movies')
      setSearch('')
      setGenre('All')
    }
  }

  async function deleteMovie(movie) {
    if (!window.confirm(`Delete "${movie.title}" from your collection?`)) return

    setUpdatingId(movie.id)
    setError('')

    try {
      const response = await authorizedFetch(`${API_URL}/movies/${movie.id}`, accessToken, { method: 'DELETE' }, onLogout)
      if (!response.ok) {
        const result = await readResponseData(response)
        throw createResponseError(response, result, 'Could not delete this movie.')
      }

      setMovies((currentMovies) => currentMovies.filter((item) => item.id !== movie.id))
    } catch (requestError) {
      if (requestError.status !== 401) setError(requestError.message)
    } finally {
      setUpdatingId(null)
    }
  }

  const heading = activePage === 'watchlist' ? 'Movies to watch' : 'The movie collection'
  const moviesToShow = activePage === 'home' ? movies.slice(0, 4) : visibleMovies

  return (
    <div className="app-shell min-h-screen bg-paper font-sans text-ink">
      <header className="topbar flex min-h-16 items-center justify-between gap-2 border-b border-line bg-white px-2.5 sm:min-h-[72px] sm:gap-5 sm:px-[7vw]">
        <button className="brand flex shrink-0 items-center gap-1.5 border-0 bg-transparent p-0 font-display text-[9px] text-ink sm:gap-2.5 sm:text-[13px]" type="button" onClick={() => setActivePage('home')}>
          <span className="brand-mark grid size-7 place-items-center rounded bg-coral text-white sm:size-8">C</span> CINESHELF
        </button>
        <nav className="main-nav flex h-16 items-stretch gap-2 sm:h-[72px] sm:gap-[30px]" aria-label="Main navigation">
          {pages.map((page) => (
            <button
              className={`nav-link relative flex items-center gap-1 border-0 bg-transparent px-0.5 text-[9px] font-bold text-muted sm:gap-[7px] sm:text-xs ${activePage === page.id ? 'active text-ink' : 'hover:text-ink'}`}
              type="button"
              key={page.id}
              onClick={() => {
                setActivePage(page.id)
                setSearch('')
                setGenre('All')
              }}
              aria-current={activePage === page.id ? 'page' : undefined}
            >
              {page.label}
              {page.id === 'watchlist' && <span className="nav-count min-w-[19px] rounded-full bg-teal px-1 py-0.5 text-center text-[10px] text-white">{toWatchCount}</span>}
            </button>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden max-w-[150px] truncate text-[10px] text-muted md:inline">{user.email}</span>
          <button className="rounded border-0 bg-transparent px-1 text-[9px] font-bold text-muted hover:text-ink sm:text-[11px]" type="button" onClick={onLogout}>Sign out</button>
          <button className="add-movie-button inline-flex size-[30px] shrink-0 items-center justify-center gap-1 rounded bg-coral p-0 text-white transition-colors hover:bg-[#be402d] sm:h-9 sm:w-auto sm:px-3 sm:text-[11px] sm:font-extrabold" type="button" onClick={() => setIsAddOpen(true)} aria-label="Add movie" title="Add movie">
            <span className="text-xl leading-none" aria-hidden="true">+</span><span className="hidden sm:inline">Add movie</span>
          </button>
        </div>
      </header>

      <main>
        {activePage === 'home' && (
          <section className="welcome-band">
            <p className="eyebrow">YOUR MOVIE COLLECTION</p>
            <h1>Make tonight<br /><span>a movie night.</span></h1>
            <p className="welcome-copy">Browse your collection, find something new, and keep track of what you have watched.</p>
            <button className="primary-button" type="button" onClick={() => setActivePage('movies')}>
              Browse all movies <span aria-hidden="true">→</span>
            </button>
            <div className="collection-stats">
              <div><strong>{movies.length}</strong><span>FILMS</span></div>
              <div><strong>{toWatchCount}</strong><span>TO WATCH</span></div>
              <div><strong>{movies.length - toWatchCount}</strong><span>WATCHED</span></div>
            </div>
          </section>
        )}

        <section className="collection-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{activePage === 'watchlist' ? 'SAVE FOR LATER' : 'FROM YOUR LIBRARY'}</p>
              <h2>{activePage === 'home' ? 'A few from your collection' : heading}</h2>
            </div>
            {activePage === 'home' && (
              <button className="text-button" type="button" onClick={() => setActivePage('movies')}>
                See all <span aria-hidden="true">→</span>
              </button>
            )}
          </div>

          {activePage !== 'home' && (
            <div className="filters">
              <label className="search-field">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search movies"
                  aria-label="Search movies"
                />
              </label>
              <label className="genre-field">
                <span>GENRE</span>
                <select value={genre} onChange={(event) => setGenre(event.target.value)} aria-label="Filter by genre">
                  {genres.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
            </div>
          )}

          {isLoading ? (
            <p className="message">Loading your movies...</p>
          ) : error && movies.length === 0 ? (
            <p className="message error-message" role="alert">{error}</p>
          ) : moviesToShow.length === 0 ? (
            <p className="message">No movies found. Try changing your search or genre.</p>
          ) : (
            <div className="movie-grid">
              {moviesToShow.map((movie) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  isOwner={movie.owner_id === user.id}
                  onToggleWatched={toggleWatched}
                  onEdit={setEditingMovie}
                  onDelete={deleteMovie}
                  isUpdating={updatingId === movie.id}
                />
              ))}
            </div>
          )}
          {error && movies.length > 0 && <p className="inline-error" role="alert">{error}</p>}
        </section>
      </main>

      <footer className="site-footer flex min-h-[58px] items-center justify-between bg-[#1d2926] px-4 py-3 text-[9px] font-bold text-[#d9e0da] sm:px-[7vw]"><span className="font-display text-[#f0957f]">CINESHELF</span><span>YOUR MOVIE COLLECTION</span></footer>
      {isAddOpen && <MovieForm onSave={saveMovie} onClose={() => setIsAddOpen(false)} />}
      {editingMovie && <MovieForm key={editingMovie.id} movie={editingMovie} onSave={saveMovie} onClose={() => setEditingMovie(null)} />}
    </div>
  )
}

export default App
