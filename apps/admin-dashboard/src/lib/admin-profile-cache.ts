import type { AdminProfile } from "./admin-profile"

type CachedAdminProfile = {
  profile: AdminProfile
  savedAt: string
}

const ADMIN_PROFILE_CACHE_PREFIX = "triketrack_admin_profile"
const ADMIN_PROFILE_EMAIL_INDEX_PREFIX = "triketrack_admin_profile_email"

const getCacheKey = (authUserId: string) => `${ADMIN_PROFILE_CACHE_PREFIX}:${authUserId}`
const getEmailIndexKey = (email: string) =>
  `${ADMIN_PROFILE_EMAIL_INDEX_PREFIX}:${email.trim().toLowerCase()}`

export const saveCachedAdminProfile = (profile: AdminProfile) => {
  window.localStorage.setItem(
    getCacheKey(profile.authUserId),
    JSON.stringify({
      profile,
      savedAt: new Date().toISOString()
    } satisfies CachedAdminProfile)
  )
  window.localStorage.setItem(getEmailIndexKey(profile.email), profile.authUserId)
}

export const getCachedAdminProfile = (authUserId: string): CachedAdminProfile | null => {
  const raw = window.localStorage.getItem(getCacheKey(authUserId))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as CachedAdminProfile
    if (parsed.profile?.authUserId !== authUserId) return null
    return parsed
  } catch {
    window.localStorage.removeItem(getCacheKey(authUserId))
    return null
  }
}

export const removeCachedAdminProfile = (authUserId: string) => {
  window.localStorage.removeItem(getCacheKey(authUserId))
}

export const getCachedAdminProfileByEmail = (email: string): CachedAdminProfile | null => {
  const normalizedEmail = email.trim().toLowerCase()
  const authUserId = window.localStorage.getItem(getEmailIndexKey(normalizedEmail))
  if (authUserId) {
    return getCachedAdminProfile(authUserId)
  }

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key?.startsWith(`${ADMIN_PROFILE_CACHE_PREFIX}:`)) continue
    const authId = key.slice(`${ADMIN_PROFILE_CACHE_PREFIX}:`.length)
    const cached = getCachedAdminProfile(authId)
    if (cached?.profile.email.trim().toLowerCase() === normalizedEmail) {
      window.localStorage.setItem(getEmailIndexKey(normalizedEmail), authId)
      return cached
    }
  }

  return null
}
