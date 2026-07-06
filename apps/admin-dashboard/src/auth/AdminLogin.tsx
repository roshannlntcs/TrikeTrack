import { useEffect, useState, type FormEvent } from "react"
import "./AdminLogin.css"

type AdminLoginProps = {
  onSignIn: (
    identifier: string,
    password: string,
    rememberMe: boolean
  ) => Promise<string | null>
  initialIdentifier?: string
  initialRememberMe?: boolean
  initialErrorMessage?: string | null
}

export default function AdminLogin({
  onSignIn,
  initialIdentifier = "",
  initialRememberMe = false,
  initialErrorMessage = null
}: AdminLoginProps) {
  const [identifier, setIdentifier] = useState(initialIdentifier)
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(initialRememberMe)
  const [errorMessage, setErrorMessage] = useState<string | null>(initialErrorMessage)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setErrorMessage(initialErrorMessage)
  }, [initialErrorMessage])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    setErrorMessage(null)
    const error = await onSignIn(identifier.trim(), password, rememberMe)
    if (error) setErrorMessage(error)
    setIsSubmitting(false)
  }

  return (
    <main className="login-page">
      <section className="login-shell">
        <div className="login-shell__brand" aria-hidden="true">
          <div className="brand-block">
            <h1 className="brand-title">
              <span className="brand-title--blue">TRIKE</span>
              <span className="brand-title--green">TRACK</span>
            </h1>
            <p className="brand-subtitle">TODA Route Monitoring System</p>
          </div>
        </div>

        <div className="login-shell__form-wrap">
          <form className="login-form" onSubmit={handleSubmit} autoComplete="off">
            <img src="/triketrack_logo.png" alt="TrikeTrack logo" className="login-form__logo" />
            <h2>Welcome, admin.</h2>
            <p className="login-form__lead">
              Please login to access TrikeTrack dashboard.
            </p>

            <label htmlFor="identifier">E-mail</label>
            <div className="input-wrap">
              <span className="input-wrap__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 12.2a3.1 3.1 0 1 0 0-6.2a3.1 3.1 0 0 0 0 6.2Z" />
                  <path d="M4.7 19.2c.7-2.8 3-4.2 7.3-4.2c4.2 0 6.5 1.4 7.3 4.2H4.7Z" />
                </svg>
              </span>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="Enter your email"
                autoComplete="off"
                required
              />
            </div>

            <label htmlFor="password">Password</label>
            <div className="input-wrap">
              <span className="input-wrap__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M17.5 10H17V7.8C17 5 14.8 3 12 3S7 5 7 7.8V10h-.5A1.5 1.5 0 0 0 5 11.5v7A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 17.5 10ZM9 7.8C9 6.1 10.3 5 12 5s3 1.1 3 2.8V10H9V7.8Z" />
                </svg>
              </span>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="off"
                required
              />
              <button
                type="button"
                className="input-wrap__toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 7c-4.9 0-8.9 4.5-9 4.7L2.5 12l.5.3C3.1 12.5 7.1 17 12 17s8.9-4.5 9-4.7l.5-.3l-.5-.3C20.9 11.5 16.9 7 12 7Zm0 8a3 3 0 1 1 0-6a3 3 0 0 1 0 6Z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 7c-4.9 0-8.9 4.5-9 4.7L2.5 12l.5.3C3.1 12.5 7.1 17 12 17c1.5 0 2.9-.4 4.1-1.1l-1.5-1.5a3 3 0 0 1-4.1-4.1L9 8.8c.9-.5 1.9-.8 3-.8c3.3 0 5.8 2.5 6.6 3.4c-.4.6-1.3 1.5-2.5 2.3l1.4 1.4c2-1.3 3.2-2.8 3.3-2.9l.5-.3l-.5-.3C20.9 11.5 16.9 7 12 7Z" />
                    <line
                      x1="3"
                      y1="3"
                      x2="21"
                      y2="21"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </button>
            </div>

            <div className="login-meta-row">
              <label className="remember-me">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                <span>Remember Me</span>
              </label>
              <a
                className="forgot-link"
                href="#"
                onClick={(event) => event.preventDefault()}
              >
                Forgot Password?
              </a>
            </div>

            {errorMessage ? <div className="login-error">{errorMessage}</div> : null}

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Logging in..." : "Log in"}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
