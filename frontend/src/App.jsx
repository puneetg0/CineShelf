import { useCallback, useEffect, useState } from 'react'
import CineShelfApp from './features/library/MovieLibrary.jsx'
import './styles/auth.css'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

class ApiError extends Error {
  constructor(message, status, fieldErrors = {}) {
    super(message)
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

const fieldLabels = {
  email: 'Email address',
  password: 'Password',
  title: 'Movie title',
  genre: 'Genre',
  release_year: 'Release year',
  rating: 'Rating',
  poster_url: 'Poster URL',
}

function validationMessage(issue, field) {
  const label = fieldLabels[field] ?? 'This value'
  if (issue.type === 'missing') return `${label} is required.`
  if (issue.type === 'string_too_short' && field === 'password') {
    return 'Password must contain at least 8 characters.'
  }
  if (field === 'release_year') return 'Enter a year between 1888 and 2100.'
  if (field === 'rating') return 'Enter a rating from 0 to 10.'
  if (field === 'poster_url') return 'Enter a valid HTTP or HTTPS poster URL.'
  if (field === 'email') return 'Enter a valid email address.'
  if (field === 'title' || field === 'genre') {
    return `${label} cannot be blank and must fit within the field limit.`
  }
  return `${label} is invalid. Please check your input.`
}

function currentRoute() {
  return window.location.hash === '#/dashboard' ? 'dashboard' : 'login'
}

function navigate(route) {
  window.location.hash = route === 'dashboard' ? '/dashboard' : '/login'
}

async function apiRequest(path, accessToken, options = {}) {
  const headers = new Headers(options.headers)
  if (options.body) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  let response
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers })
  } catch (requestError) {
    if (requestError.name === 'AbortError') throw requestError
    throw new Error('Could not connect to CineShelf. Check that the backend is running.')
  }

  const result = response.status === 204
    ? null
    : await response.json().catch(() => null)

  if (!response.ok) {
    const detail = result?.detail
    if (Array.isArray(detail)) {
      const fieldErrors = {}
      for (const issue of detail) {
        const field = issue.loc?.at(-1)
        if (typeof field === 'string' && fieldLabels[field]) {
          fieldErrors[field] ??= validationMessage(issue, field)
        }
      }
      const message = Object.values(fieldErrors).join(' ') || 'Please check the information and try again.'
      throw new ApiError(message, response.status, fieldErrors)
    }
    const message = typeof detail === 'string'
      ? detail
      : response.status >= 500
        ? 'CineShelf could not complete that request. Please try again.'
        : 'The request could not be completed. Please check your information and try again.'
    throw new ApiError(message, response.status)
  }

  return result
}

function LoginForm({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selectedRole, setSelectedRole] = useState('user')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      if (mode === 'register') {
        await apiRequest('/auth/register', '', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        })
      }

      const result = await apiRequest('/auth/login', '', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      const account = await apiRequest('/auth/me', result.access_token)
      if (account.role !== selectedRole) {
        throw new ApiError(
          `This account has the ${account.role} role. Choose that role to sign in.`,
          403,
        )
      }
      onLogin(result.access_token)
    } catch (requestError) {
      setError(requestError instanceof Error
        ? requestError.message
        : 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth-card" aria-labelledby="auth-title">
      <p className="eyebrow">YOUR NEXT MOVIE NIGHT STARTS HERE</p>
      <h1 id="auth-title">{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h1>
      <p className="card-copy">
        {mode === 'login'
          ? 'Sign in to open your personal CineShelf.'
          : 'Register to make a secure CineShelf account.'}
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="email">Email address</label>
        <input
          autoComplete="email"
          id="email"
          maxLength={254}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />

        <label htmlFor="password">Password</label>
        <input
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          id="password"
          minLength={8}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 8 characters"
          required
          type="password"
          value={password}
        />

        {mode === 'login' && (
          <>
            <label htmlFor="account-role">Sign in as</label>
            <select
              id="account-role"
              onChange={(event) => setSelectedRole(event.target.value)}
              value={selectedRole}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}

        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting
            ? 'Please wait...'
            : mode === 'login' ? 'Sign in' : 'Create account'}
          {!isSubmitting && <span aria-hidden="true">→</span>}
        </button>
      </form>

      <p className="mode-switch">
        {mode === 'login' ? 'New to CineShelf?' : 'Already have an account?'}
        <button
          onClick={() => {
            setMode((currentMode) => currentMode === 'login' ? 'register' : 'login')
            setSelectedRole('user')
            setError('')
          }}
          type="button"
        >
          {mode === 'login' ? 'Create an account' : 'Sign in'}
        </button>
      </p>

      <p className="security-note">
        Passwords are hashed by the API. Your short-lived access token stays in
        memory and is sent only with CineShelf API requests.
      </p>
    </section>
  )
}

function AuthenticatedCineShelf({ accessToken, onLogout }) {
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function verifySession() {
      try {
        const account = await apiRequest('/auth/me', accessToken, {
          signal: controller.signal,
        })
        setUser(account)
      } catch (requestError) {
        if (requestError.name === 'AbortError') return
        if (requestError.status === 401) {
          onLogout()
        } else {
          setError(requestError.message)
        }
      }
    }

    verifySession()
    return () => controller.abort()
  }, [accessToken, onLogout])

  if (error) {
    return (
      <main className="auth-page">
        <section className="auth-card" role="alert">
          <h1>Could not open CineShelf.</h1>
          <p className="card-copy">{error}</p>
          <button className="primary-button" onClick={onLogout} type="button">Return to sign in</button>
        </section>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="auth-page">
        <p className="card-copy">Checking your sign-in...</p>
      </main>
    )
  }

  if (user.role === 'admin') {
    return (
      <AdminDashboard
        accessToken={accessToken}
        onLogout={onLogout}
        user={user}
      />
    )
  }

  return (
    <CineShelfApp
      accessToken={accessToken}
      onLogout={onLogout}
      user={user}
    />
  )
}

function AdminDashboard({ accessToken, onLogout, user }) {
  const [activeSection, setActiveSection] = useState('movies')
  const [users, setUsers] = useState([])
  const [movies, setMovies] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadAdminData() {
      setIsLoading(true)
      setError('')
      try {
        const [allUsers, allMovies] = await Promise.all([
          apiRequest('/admin/users', accessToken, { signal: controller.signal }),
          apiRequest('/admin/movies', accessToken, { signal: controller.signal }),
        ])
        setUsers(allUsers)
        setMovies(allMovies)
      } catch (requestError) {
        if (requestError.name === 'AbortError') return
        if (requestError.status === 401) {
          onLogout()
          return
        }
        setError(requestError.message)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    loadAdminData()
    return () => controller.abort()
  }, [accessToken, onLogout, refreshKey])

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <a className="admin-brand" href="#/dashboard">
          <span className="admin-brand-mark">C</span>
          <span>CINESHELF <small>ADMIN</small></span>
        </a>
        <div className="admin-account">
          <span>{user.email}</span>
          <button onClick={onLogout} type="button">Sign out</button>
        </div>
      </header>

      <main className="admin-content">
        <div className="admin-heading">
          <div>
            <p className="admin-eyebrow">CINESHELF MANAGEMENT</p>
            <h1>Administrator dashboard</h1>
            <p>Review registered accounts and every movie across all personal libraries.</p>
          </div>
          <button
            className="admin-refresh"
            disabled={isLoading}
            onClick={() => setRefreshKey((value) => value + 1)}
            type="button"
          >
            Refresh data
          </button>
        </div>

        <div className="admin-stats">
          <article><span>REGISTERED USERS</span><strong>{users.length}</strong></article>
          <article><span>MOVIES ACROSS ALL LIBRARIES</span><strong>{movies.length}</strong></article>
          <article><span>YOUR ROLE</span><strong>Admin</strong></article>
        </div>

        <section className="admin-panel">
          <div className="admin-tabs" role="tablist" aria-label="Admin data">
            <button
              aria-selected={activeSection === 'movies'}
              className={activeSection === 'movies' ? 'active' : ''}
              onClick={() => setActiveSection('movies')}
              role="tab"
              type="button"
            >
              All movies ({movies.length})
            </button>
            <button
              aria-selected={activeSection === 'users'}
              className={activeSection === 'users' ? 'active' : ''}
              onClick={() => setActiveSection('users')}
              role="tab"
              type="button"
            >
              All users ({users.length})
            </button>
          </div>

          {error && <p className="admin-error" role="alert">{error}</p>}
          {isLoading ? (
            <p className="admin-message">Loading administrator data...</p>
          ) : error ? null : activeSection === 'users' ? (
            users.length === 0 ? (
              <p className="admin-message">There are no registered users yet.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <caption className="sr-only">All CineShelf user accounts</caption>
                  <thead><tr><th scope="col">User ID</th><th scope="col">Email</th><th scope="col">Role</th></tr></thead>
                  <tbody>
                    {users.map((account) => (
                      <tr key={account.id}>
                        <td>{account.id}</td>
                        <td>{account.email}</td>
                        <td><span className={`role-badge ${account.role}`}>{account.role}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : movies.length === 0 ? (
            <p className="admin-message">There are no movies in any library yet.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <caption className="sr-only">All movies across all CineShelf accounts</caption>
                <thead>
                  <tr><th scope="col">Title</th><th scope="col">Owner</th><th scope="col">Genre</th><th scope="col">Year</th><th scope="col">Rating</th><th scope="col">Status</th></tr>
                </thead>
                <tbody>
                  {movies.map((movie) => (
                    <tr key={movie.id}>
                      <td>{movie.title}</td>
                      <td>{movie.owner_email ?? 'Unassigned'}</td>
                      <td>{movie.genre}</td>
                      <td>{movie.release_year}</td>
                      <td>{Number(movie.rating).toFixed(1)}</td>
                      <td>{movie.watched ? 'Watched' : 'To watch'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <p className="admin-notice">Admin access is read-only. Movie changes remain in each user’s personal library.</p>
      </main>
    </div>
  )
}

export default function App() {
  const [route, setRoute] = useState(currentRoute)
  const [accessToken, setAccessToken] = useState('')

  useEffect(() => {
    function updateRoute() {
      setRoute(currentRoute())
    }

    window.addEventListener('hashchange', updateRoute)
    return () => window.removeEventListener('hashchange', updateRoute)
  }, [])

  function handleLogin(token) {
    setAccessToken(token)
    navigate('dashboard')
  }

  const handleLogout = useCallback(() => {
    setAccessToken('')
    navigate('login')
  }, [])

  if (route === 'dashboard' && accessToken) {
    return (
      <AuthenticatedCineShelf
        accessToken={accessToken}
        onLogout={handleLogout}
      />
    )
  }

  return (
    <main className="auth-page">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="auth-header">
        <a aria-label="CineShelf authentication demo home" className="brand" href="#/login">
          <span className="brand-mark">C</span>
          <span>CINESHELF</span>
        </a>
        <span className="header-tag">YOUR MOVIES</span>
      </header>

      <div className="auth-layout">
        <section className="intro">
          <p className="eyebrow">A LITTLE MORE PERSONAL</p>
          <h2>Your shelf.<br /><span>Your stories.</span></h2>
          <p className="intro-copy">
            Sign in to browse your CineShelf, organise your collection, and plan your next movie night.
          </p>
          <div className="learning-points">
            <p><span>01</span> Your account is protected by a JWT</p>
            <p><span>02</span> Search and filter your movie collection</p>
            <p><span>03</span> Add, edit, and manage your movies</p>
          </div>
        </section>
        <LoginForm onLogin={handleLogin} />
      </div>

      <footer className="auth-footer">
        <span>BUILT FOR MOVIE LOVERS</span>
        <span>YOUR PERSONAL MOVIE LIBRARY</span>
      </footer>
    </main>
  )
}
