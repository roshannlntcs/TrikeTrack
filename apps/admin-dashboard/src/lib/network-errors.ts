const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return String(error)
}

const isNetworkFetchError = (message: string) =>
  /failed to fetch|networkerror|load failed/i.test(message)

export const toSupabaseAuthErrorMessage = (error: unknown) => {
  const message = getErrorMessage(error)

  if (isNetworkFetchError(message)) {
    return "Unable to reach Supabase right now. Check your internet connection and the admin dashboard Supabase settings."
  }

  return message
}

export const toAdminApiErrorMessage = (error: unknown) => {
  const message = getErrorMessage(error)

  if (isNetworkFetchError(message)) {
    if (import.meta.env.DEV) {
      return "Unable to reach the admin API. Make sure the backend server is running on port 4000."
    }

    return "Unable to reach the admin API. Check that the backend service is online."
  }

  return message
}
