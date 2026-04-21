const MTOP_VALIDITY_YEARS = 2

const formatDateInput = (value: Date) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export const getDefaultPermitExpirationDate = (baseDate = new Date()) => {
  const next = new Date(baseDate)
  next.setFullYear(next.getFullYear() + MTOP_VALIDITY_YEARS)
  return formatDateInput(next)
}
