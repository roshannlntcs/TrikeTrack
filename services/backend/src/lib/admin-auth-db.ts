import fs from "node:fs"
import path from "node:path"

export type AdminUser = {
  id: string
  email: string
  passwordHash: string
  createdAt: string
}

type AdminAuthDatabase = {
  users: AdminUser[]
}

const DEFAULT_ADMIN_EMAIL = "todaadmin@gmail.com"
const DEFAULT_ADMIN_PASSWORD_HASH =
  "pbkdf2$sha512$210000$aca50226c99fd2878603df9d6482fe25$da3d5efb805ae9592e9797a8aea78ea4b01924dd1d918ed4c8496d36551dd3c88f610be85ea6ccbb8ba10bfc5f6a07602be1a2f4dd139b1c6267cf814f369689"

const DB_PATH = path.join(process.cwd(), "data", "admin-users.json")

const normalizeEmail = (value: string) => value.trim().toLowerCase()

const defaultDatabase = (): AdminAuthDatabase => ({
  users: [
    {
      id: "admin-001",
      email: DEFAULT_ADMIN_EMAIL,
      passwordHash: DEFAULT_ADMIN_PASSWORD_HASH,
      createdAt: new Date().toISOString()
    }
  ]
})

const writeDatabase = (db: AdminAuthDatabase) => {
  const dir = path.dirname(DB_PATH)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8")
}

const readDatabase = (): AdminAuthDatabase => {
  if (!fs.existsSync(DB_PATH)) {
    const seeded = defaultDatabase()
    writeDatabase(seeded)
    return seeded
  }

  try {
    const raw = fs.readFileSync(DB_PATH, "utf8")
    const parsed = JSON.parse(raw) as AdminAuthDatabase
    if (!parsed || !Array.isArray(parsed.users)) {
      const seeded = defaultDatabase()
      writeDatabase(seeded)
      return seeded
    }
    return parsed
  } catch {
    const seeded = defaultDatabase()
    writeDatabase(seeded)
    return seeded
  }
}

export const ensureDefaultAdminUser = () => {
  const db = readDatabase()
  const defaultUserIndex = db.users.findIndex(
    (user) => normalizeEmail(user.email) === DEFAULT_ADMIN_EMAIL
  )

  if (defaultUserIndex === -1) {
    db.users.push({
      id: "admin-001",
      email: DEFAULT_ADMIN_EMAIL,
      passwordHash: DEFAULT_ADMIN_PASSWORD_HASH,
      createdAt: new Date().toISOString()
    })
    writeDatabase(db)
    return
  }

  const defaultUser = db.users[defaultUserIndex]
  if (defaultUser.passwordHash === DEFAULT_ADMIN_PASSWORD_HASH) return

  db.users[defaultUserIndex] = {
    ...defaultUser,
    passwordHash: DEFAULT_ADMIN_PASSWORD_HASH
  }
  writeDatabase(db)
}

export const findAdminByEmail = (email: string) => {
  ensureDefaultAdminUser()
  const db = readDatabase()
  const normalized = normalizeEmail(email)
  return db.users.find((user) => normalizeEmail(user.email) === normalized) ?? null
}
