import { useState } from "react"
import AdminLogin from "./auth/AdminLogin"
import AdminShell from "./layout/AdminShell"

const ADMIN_SESSION_KEY = "triketrack_admin_signed_in"
const AUTH_ENDPOINT =
  import.meta.env.VITE_AUTH_ENDPOINT || "/api/auth/login"

type LoginResponse = {
  ok?: boolean
  message?: string
}

const BACKEND_DOWN_MESSAGE =
  "Unable to connect to backend. Please start backend on port 4000 and try again."

export default function App() {
  const [isSignedIn, setIsSignedIn] = useState<boolean>(() => {
    return window.localStorage.getItem(ADMIN_SESSION_KEY) === "1"
  })

  const handleSignIn = async (
    identifier: string,
    password: string
  ): Promise<string | null> => {
    if (!identifier || !password) return "Please enter email and password."

    try {
      const response = await fetch(AUTH_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identifier, password })
      })

      const contentType = response.headers.get("content-type") ?? ""
      const payload = contentType.includes("application/json")
        ? ((await response.json().catch(() => ({}))) as LoginResponse)
        : ({} as LoginResponse)

      if (!response.ok) {
        if (response.status >= 500) return BACKEND_DOWN_MESSAGE
        return payload.message || "incorrect email or password, please try again"
      }

      if (payload.ok !== true) {
        return payload.message || "incorrect email or password, please try again"
      }

      window.localStorage.setItem(ADMIN_SESSION_KEY, "1")
      setIsSignedIn(true)
      return null
    } catch {
      return BACKEND_DOWN_MESSAGE
    }
  }

  const handleLogout = () => {
    window.localStorage.removeItem(ADMIN_SESSION_KEY)
    setIsSignedIn(false)
  }

  if (!isSignedIn) {
    return <AdminLogin onSignIn={handleSignIn} />
  }

  return <AdminShell onLogout={handleLogout} />
}
