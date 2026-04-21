const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY

type SupabaseUser = {
  id: string
  email?: string
}

const ensureConfig = () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing SUPABASE_URL or either SUPABASE_PUBLISHABLE_KEY or SUPABASE_ANON_KEY in backend environment."
    )
  }
}

export const getSupabaseUserFromAccessToken = async (accessToken: string) => {
  ensureConfig()

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${accessToken}`
    },
    cache: "no-store"
  })

  if (!response.ok) {
    return null
  }

  return (await response.json()) as SupabaseUser
}
