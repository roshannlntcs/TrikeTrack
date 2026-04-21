import { useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import AdminLogin from "./auth/AdminLogin"
import AdminShell from "./layout/AdminShell"
import { fetchAdminProfile, type AdminProfile } from "./lib/admin-profile"
import { toSupabaseAuthErrorMessage } from "./lib/network-errors"
import { supabase } from "./lib/supabase"

const ADMIN_REMEMBERED_EMAIL_KEY = "triketrack_admin_remembered_email"

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [rememberedEmail, setRememberedEmail] = useState<string>(() => {
    return window.localStorage.getItem(ADMIN_REMEMBERED_EMAIL_KEY) ?? ""
  })
  const [defaultRememberMe, setDefaultRememberMe] = useState<boolean>(() => {
    return (window.localStorage.getItem(ADMIN_REMEMBERED_EMAIL_KEY) ?? "").length > 0
  })

  useEffect(() => {
    let active = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setAuthReady(true)
    })

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setAuthReady(true)
      if (!nextSession) {
        setAdminProfile(null)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true

    const loadProfile = async () => {
      if (!session?.access_token) {
        setAdminProfile(null)
        return
      }

      const result = await fetchAdminProfile(session.access_token)
      if (!active) return

      if (result.error) {
        setAuthError(result.error)
        setAdminProfile(null)
        await supabase.auth.signOut()
        return
      }

      setAuthError(null)
      setAdminProfile(result.profile)
    }

    void loadProfile()

    return () => {
      active = false
    }
  }, [session])

  const handleSignIn = async (
    identifier: string,
    password: string,
    rememberMe: boolean
  ): Promise<string | null> => {
    if (!identifier || !password) return "Please enter email and password."

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: identifier,
        password
      })

      if (error) {
        if (error.message.toLowerCase().includes("invalid login credentials")) {
          return "incorrect email or password, please try again"
        }
        return toSupabaseAuthErrorMessage(error)
      }

      if (!data.session?.access_token) {
        return "Login did not return a valid session."
      }

      const profileResult = await fetchAdminProfile(data.session.access_token)
      if (profileResult.error) {
        await supabase.auth.signOut()
        return profileResult.error
      }

      if (rememberMe) {
        window.localStorage.setItem(ADMIN_REMEMBERED_EMAIL_KEY, identifier)
        setRememberedEmail(identifier)
        setDefaultRememberMe(true)
      } else {
        window.localStorage.removeItem(ADMIN_REMEMBERED_EMAIL_KEY)
        setRememberedEmail("")
        setDefaultRememberMe(false)
      }

      setAuthError(null)
      setAdminProfile(profileResult.profile)
      return null
    } catch (error) {
      return toSupabaseAuthErrorMessage(error)
    }
  }

  const handleLogout = () => {
    setAuthError(null)
    setAdminProfile(null)
    void supabase.auth.signOut()
  }

  if (!authReady) {
    return null
  }

  if (!session || !adminProfile) {
    return (
      <AdminLogin
        onSignIn={handleSignIn}
        initialIdentifier={rememberedEmail}
        initialRememberMe={defaultRememberMe}
        initialErrorMessage={authError}
      />
    )
  }

  return (
    <AdminShell
      onLogout={handleLogout}
      adminProfile={adminProfile}
      accessToken={session.access_token}
    />
  )
}
