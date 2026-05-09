import { useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import AdminLogin from "./auth/AdminLogin"
import OfflineStatus from "./components/OfflineStatus"
import AdminShell from "./layout/AdminShell"
import { fetchAdminProfile, type AdminProfile } from "./lib/admin-profile"
import {
  getCachedAdminProfileByEmail,
  getCachedAdminProfile,
  removeCachedAdminProfile,
  saveCachedAdminProfile
} from "./lib/admin-profile-cache"
import { isNetworkErrorMessage, toSupabaseAuthErrorMessage } from "./lib/network-errors"
import { getCachedMasterData } from "./lib/superadmin-api"
import { supabase } from "./lib/supabase"

const ADMIN_REMEMBERED_EMAIL_KEY = "triketrack_admin_remembered_email"

const getOfflineAdminProfile = async (email: string): Promise<AdminProfile | null> => {
  const cached = getCachedAdminProfileByEmail(email)
  if (cached) return cached.profile

  const masterData = await getCachedMasterData()
  const admin = masterData?.administrators.find(
    (item) => item.email.trim().toLowerCase() === email.trim().toLowerCase()
  )
  if (!admin) return null

  const profile: AdminProfile = {
    adminId: admin.adminId,
    authUserId: admin.authUserId,
    email: admin.email,
    role: admin.role,
    status: admin.status,
    barangayId: admin.barangayId,
    barangayName: admin.barangayName,
    todaId: admin.todaId,
    todaName: admin.todaName,
    city: admin.city
  }
  saveCachedAdminProfile(profile)
  return profile
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null)
  const [offlineViewerProfile, setOfflineViewerProfile] = useState<AdminProfile | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [rememberedEmail, setRememberedEmail] = useState<string>(() => {
    return window.localStorage.getItem(ADMIN_REMEMBERED_EMAIL_KEY) ?? ""
  })
  const [defaultRememberMe, setDefaultRememberMe] = useState<boolean>(() => {
    return (window.localStorage.getItem(ADMIN_REMEMBERED_EMAIL_KEY) ?? "").length > 0
  })

  useEffect(() => {
    let active = true

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      if (!data.session && !window.navigator.onLine && rememberedEmail) {
        const profile = await getOfflineAdminProfile(rememberedEmail)
        if (!active) return
        if (profile) {
          setOfflineViewerProfile(profile)
          setAdminProfile(profile)
          setAuthError(null)
        }
      }
      setAuthReady(true)
    })

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setOfflineViewerProfile(null)
      setAuthReady(true)
      if (!nextSession) {
        setAdminProfile(null)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [rememberedEmail])

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
        const cached = getCachedAdminProfile(session.user.id)
        if (cached && (!window.navigator.onLine || isNetworkErrorMessage(result.error))) {
          setAuthError(null)
          setOfflineViewerProfile(cached.profile)
          setAdminProfile(cached.profile)
          return
        }

        setAuthError(result.error)
        setAdminProfile(null)
        await supabase.auth.signOut()
        return
      }

      setAuthError(null)
      setOfflineViewerProfile(null)
      if (result.profile) {
        saveCachedAdminProfile(result.profile)
        setAdminProfile(result.profile)
      }
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

    if (!window.navigator.onLine && rememberMe) {
      const profile = await getOfflineAdminProfile(identifier)
      if (profile) {
        setOfflineViewerProfile(profile)
        setAdminProfile(profile)
        setAuthError(null)
        return null
      }
      return "Offline viewer mode needs one successful online login and cached dashboard data first."
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: identifier,
        password
      })

      if (error) {
        const profile = !window.navigator.onLine && rememberMe
          ? await getOfflineAdminProfile(identifier)
          : null
        if (profile) {
          setOfflineViewerProfile(profile)
          setAdminProfile(profile)
          setAuthError(null)
          return null
        }
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

      if (!profileResult.profile) {
        await supabase.auth.signOut()
        return "Login did not return an admin profile."
      }

      saveCachedAdminProfile(profileResult.profile)

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
      const profile = !window.navigator.onLine && rememberMe
        ? await getOfflineAdminProfile(identifier)
        : null
      if (profile) {
        setOfflineViewerProfile(profile)
        setAdminProfile(profile)
        setAuthError(null)
        return null
      }
      return toSupabaseAuthErrorMessage(error)
    }
  }

  const handleLogout = () => {
    if (session?.user.id) {
      removeCachedAdminProfile(session.user.id)
    }
    setAuthError(null)
    setOfflineViewerProfile(null)
    setAdminProfile(null)
    void supabase.auth.signOut()
  }

  if (!authReady) {
    return <OfflineStatus />
  }

  if ((!session && !offlineViewerProfile) || !adminProfile) {
    return (
      <>
        <AdminLogin
          onSignIn={handleSignIn}
          initialIdentifier={rememberedEmail}
          initialRememberMe={defaultRememberMe}
          initialErrorMessage={authError}
        />
        <OfflineStatus />
      </>
    )
  }

  return (
    <>
      <AdminShell
        onLogout={handleLogout}
        adminProfile={adminProfile}
        accessToken={session?.access_token ?? ""}
        offlineViewerMode={Boolean(offlineViewerProfile)}
      />
      <OfflineStatus />
    </>
  )
}
