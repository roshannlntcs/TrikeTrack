const MTOP_VALIDITY_YEARS = 2

const formatDateInput = (value: Date) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const parseDateInput = (value?: string) => {
  if (!value) return null

  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return null

  return new Date(year, month - 1, day)
}

export const getDefaultPermitExpirationDate = (baseDate = new Date()) => {
  const next = new Date(baseDate)
  next.setFullYear(next.getFullYear() + MTOP_VALIDITY_YEARS)
  return formatDateInput(next)
}

export const getPermitExpiryState = (permitExpirationDate?: string, now = new Date()) => {
  const parsed = parseDateInput(permitExpirationDate)
  if (!parsed) {
    return {
      status: "missing" as const,
      label: "No permit expiry set",
      expiresAtTs: null as number | null
    }
  }

  const expiresAt = new Date(parsed)
  expiresAt.setHours(23, 59, 59, 999)

  if (expiresAt.getTime() < now.getTime()) {
    return {
      status: "expired" as const,
      label: `Expired on ${parsed.toLocaleDateString()}`,
      expiresAtTs: expiresAt.getTime()
    }
  }

  return {
    status: "valid" as const,
    label: `Valid until ${parsed.toLocaleDateString()}`,
    expiresAtTs: expiresAt.getTime()
  }
}
