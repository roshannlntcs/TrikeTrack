import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"

const SCRYPT_KEYLEN = 64

export const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString("hex")
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex")
  return `${salt}:${derived}`
}

export const verifyPassword = (password: string, storedHash: string) => {
  const [salt, storedDerived] = storedHash.split(":")
  if (!salt || !storedDerived) return false

  const derived = scryptSync(password, salt, SCRYPT_KEYLEN)
  const stored = Buffer.from(storedDerived, "hex")
  if (stored.length !== derived.length) return false

  return timingSafeEqual(stored, derived)
}
