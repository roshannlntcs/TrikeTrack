import crypto from "node:crypto"

const HASH_ALGORITHM = "pbkdf2"
const DIGEST = "sha512"
const ITERATIONS = 210000
const KEY_LENGTH = 64

export const hashPassword = (password: string, salt?: string) => {
  const normalizedSalt = salt ?? crypto.randomBytes(16).toString("hex")
  const hash = crypto
    .pbkdf2Sync(password, normalizedSalt, ITERATIONS, KEY_LENGTH, DIGEST)
    .toString("hex")
  return `${HASH_ALGORITHM}$${DIGEST}$${ITERATIONS}$${normalizedSalt}$${hash}`
}

export const verifyPassword = (password: string, storedHash: string) => {
  const parts = storedHash.split("$")
  if (parts.length !== 5) return false

  const [algorithm, digest, iterationsRaw, salt, expectedHashHex] = parts
  if (algorithm !== HASH_ALGORITHM) return false

  const iterations = Number(iterationsRaw)
  if (!Number.isFinite(iterations) || iterations <= 0) return false

  const derivedHex = crypto
    .pbkdf2Sync(password, salt, iterations, KEY_LENGTH, digest)
    .toString("hex")

  const expected = Buffer.from(expectedHashHex, "hex")
  const derived = Buffer.from(derivedHex, "hex")
  if (expected.length !== derived.length) return false
  return crypto.timingSafeEqual(expected, derived)
}
