import { useEffect, useMemo, useState } from "react"
import {
  createMasterDataItem,
  deleteMasterDataItem,
  fetchMasterData,
  updateMasterDataItem,
  type AdministratorRecord,
  type AdministratorRole,
  type BarangayRecord,
  type DriverRecord,
  type EntityStatus,
  type MasterDataSnapshot,
  type RouteRecord,
  type TodaRecord,
  type TricycleRecord
} from "../lib/superadmin-api"
import DeleteConfirmDialog from "../components/DeleteConfirmDialog"
import "./SuperadminPage.css"

type SuperadminPageProps = {
  accessToken: string
  mode?: "superadmin" | "toda-admin"
  lockedTodaId?: number
  lockedTodaLabel?: string
  searchQuery?: string
  onSearchPlaceholderChange?: (placeholder: string) => void
  onDataChanged?: () => void
}

type SuperadminTab = "admin-panel" | "barangays" | "todas" | "routes" | "administrators"
type SuperadminModalEntity = "administrator" | "barangay" | "toda" | "route"

type SuperadminModalState = {
  entity: SuperadminModalEntity
  mode: "create" | "edit"
  id?: number
}

type PendingDeleteState = {
  entity: SuperadminModalEntity
  id: number
  title: string
  description: string
  confirmLabel: string
}

type BarangayFormState = {
  barangayName: string
  district: string
  city: string
  status: EntityStatus
}

type TodaFormState = {
  barangayId: string
  todaName: string
  status: EntityStatus
}

type RouteFormState = {
  todaId: string
  origin: string
  destination: string
  defaultFareAmount: string
  geofenceGeojsonText: string
  status: EntityStatus
}

type AdministratorFormState = {
  adminId?: number
  email: string
  password: string
  role: AdministratorRole
  barangayId: string
  todaId: string
  status: EntityStatus
}

type RecentActivityItem = {
  key: string
  category: "Administrator" | "Barangay" | "TODA" | "Route"
  title: string
  scope: string
  status: EntityStatus
  createdAt: string
}

const STATUS_OPTIONS: EntityStatus[] = ["active", "inactive", "suspended"]
const ROLE_OPTIONS: AdministratorRole[] = ["superadmin", "barangay_admin", "toda_admin"]

const SETTINGS_TABS: Array<{ key: SuperadminTab; label: string }> = [
  { key: "admin-panel", label: "Admin Panel" },
  { key: "barangays", label: "Barangays" },
  { key: "todas", label: "TODAs" },
  { key: "routes", label: "Routes" },
  { key: "administrators", label: "Administrators" }
]

const RefreshIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 12a9 9 0 0 1-15.4 6.4" />
    <path d="M3 12A9 9 0 0 1 18.4 5.6" />
    <path d="M18 2v4h4" />
    <path d="M6 22v-4H2" />
  </svg>
)

const initialMasterData: MasterDataSnapshot = {
  administrators: [],
  barangays: [],
  todas: [],
  drivers: [],
  tricycles: [],
  routes: []
}

const createBarangayForm = (): BarangayFormState => ({
  barangayName: "",
  district: "",
  city: "Davao City",
  status: "active"
})

const createTodaForm = (): TodaFormState => ({
  barangayId: "",
  todaName: "",
  status: "active"
})

const createRouteForm = (): RouteFormState => ({
  todaId: "",
  origin: "",
  destination: "",
  defaultFareAmount: "",
  geofenceGeojsonText: "",
  status: "active"
})

const createAdministratorForm = (): AdministratorFormState => ({
  email: "",
  password: "",
  role: "barangay_admin",
  barangayId: "",
  todaId: "",
  status: "active"
})

const toDateInputValue = (value?: string) => (value ? value.slice(0, 10) : "")

const formatStatusLabel = (status: EntityStatus) =>
  status.charAt(0).toUpperCase() + status.slice(1)

const formatRoleLabel = (role: AdministratorRole) =>
  role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")

const formatEntityLabel = (entity: SuperadminModalEntity) =>
  entity === "toda"
    ? "TODA"
    : entity === "administrator"
      ? "Administrator"
      : entity.charAt(0).toUpperCase() + entity.slice(1)

const formatAdministratorScope = (row: AdministratorRecord) => {
  if (row.role === "superadmin") return "System-wide"
  if (row.todaName) return `${row.barangayName ?? "Assigned barangay"} / ${row.todaName}`
  if (row.barangayName) return row.barangayName
  return "No scope assigned"
}

const formatDateLabel = (value?: string) =>
  value ? new Date(value).toLocaleDateString() : "Not available"

const formatFareLabel = (value?: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value)
    : "Not set"

const textMatchesSearch = (
  normalizedSearchQuery: string,
  ...values: Array<string | number | boolean | undefined | null>
) =>
  values.some(
    (value) =>
      value !== undefined &&
      value !== null &&
      String(value).toLowerCase().includes(normalizedSearchQuery)
  )

const isStrongTemporaryPassword = (value: string) =>
  value.length >= 8 &&
  /[a-z]/.test(value) &&
  /[A-Z]/.test(value) &&
  /\d/.test(value)

export default function SuperadminPage({
  accessToken,
  mode = "superadmin",
  lockedTodaId,
  lockedTodaLabel,
  searchQuery: controlledSearchQuery,
  onSearchPlaceholderChange,
  onDataChanged
}: SuperadminPageProps) {
  const isTodaAdminMode = mode === "toda-admin"
  const [activeTab, setActiveTab] = useState<SuperadminTab>("admin-panel")
  const [data, setData] = useState<MasterDataSnapshot>(initialMasterData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [activeModal, setActiveModal] = useState<SuperadminModalState | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteState | null>(null)

  const [barangayForm, setBarangayForm] = useState<BarangayFormState>(createBarangayForm)
  const [todaForm, setTodaForm] = useState<TodaFormState>(createTodaForm)
  const [routeForm, setRouteForm] = useState<RouteFormState>(createRouteForm)
  const [administratorForm, setAdministratorForm] =
    useState<AdministratorFormState>(createAdministratorForm)

  const [driverForm, setDriverForm] = useState({
    todaId: lockedTodaId ? String(lockedTodaId) : "",
    tricycleId: "",
    qrId: "",
    firstName: "",
    lastName: "",
    contactNo: ""
  })
  const [tricycleForm, setTricycleForm] = useState({
    todaId: lockedTodaId ? String(lockedTodaId) : "",
    plateNo: "",
    regNo: "",
    permitExpirationDate: ""
  })

  const loadMasterData = async () => {
    setLoading(true)
    try {
      const snapshot = await fetchMasterData(accessToken)
      setData(snapshot)
      setError(null)
    } catch (loadError) {
      setError(String(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMasterData()
  }, [accessToken])

  useEffect(() => {
    if (!isTodaAdminMode || !lockedTodaId) return

    setDriverForm((current) => ({ ...current, todaId: String(lockedTodaId) }))
    setTricycleForm((current) => ({ ...current, todaId: String(lockedTodaId) }))
  }, [isTodaAdminMode, lockedTodaId])

  useEffect(() => {
    if (isTodaAdminMode) {
      onSearchPlaceholderChange?.("Search driver ID, tricycle ID, plate...")
      return
    }

    const placeholder =
      activeTab === "admin-panel"
        ? "Search admins, barangays, TODAs, routes..."
        : activeTab === "barangays"
          ? "Search barangay ID, name, district, city..."
          : activeTab === "todas"
            ? "Search TODA ID, name, barangay..."
            : activeTab === "routes"
              ? "Search route ID, TODA, origin, destination..."
              : "Search admin ID, email, role, scope..."

    onSearchPlaceholderChange?.(placeholder)
  }, [activeTab, isTodaAdminMode, onSearchPlaceholderChange])

  const searchQuery = controlledSearchQuery ?? ""
  const normalizedSearchQuery = searchQuery.trim().toLowerCase()
  const hasSearchQuery = normalizedSearchQuery.length > 0

  const todaOptions = useMemo(() => data.todas, [data.todas])
  const barangayOptions = useMemo(() => data.barangays, [data.barangays])
  const tricycleOptions = useMemo(() => data.tricycles, [data.tricycles])

  const recentActivity = useMemo<RecentActivityItem[]>(() => {
    const items: RecentActivityItem[] = [
      ...data.administrators.map((row) => ({
        key: `administrator-${row.adminId}`,
        category: "Administrator" as const,
        title: row.email,
        scope: formatAdministratorScope(row),
        status: row.status,
        createdAt: row.createdAt
      })),
      ...data.barangays.map((row) => ({
        key: `barangay-${row.barangayId}`,
        category: "Barangay" as const,
        title: row.barangayName,
        scope: row.city,
        status: row.status,
        createdAt: row.createdAt
      })),
      ...data.todas.map((row) => ({
        key: `toda-${row.todaId}`,
        category: "TODA" as const,
        title: row.todaName,
        scope: row.barangayName,
        status: row.status,
        createdAt: row.createdAt
      })),
      ...data.routes.map((row) => ({
        key: `route-${row.routeId}`,
        category: "Route" as const,
        title: `${row.origin} -> ${row.destination}`,
        scope: `${row.barangayName} / ${row.todaName}`,
        status: row.status,
        createdAt: row.createdAt
      }))
    ]

    return items
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 8)
  }, [data.administrators, data.barangays, data.routes, data.todas])

  const filteredRecentActivity = useMemo(() => {
    if (!hasSearchQuery) return recentActivity
    return recentActivity.filter((item) =>
      textMatchesSearch(
        normalizedSearchQuery,
        item.key,
        item.category,
        item.title,
        item.scope,
        item.status,
        item.createdAt
      )
    )
  }, [hasSearchQuery, normalizedSearchQuery, recentActivity])

  const filteredBarangays = useMemo(() => {
    if (!hasSearchQuery) return data.barangays
    return data.barangays.filter((row) =>
      textMatchesSearch(
        normalizedSearchQuery,
        row.barangayId,
        row.barangayName,
        row.district,
        row.city,
        row.status,
        row.todaCount,
        row.createdAt
      )
    )
  }, [data.barangays, hasSearchQuery, normalizedSearchQuery])

  const filteredTodas = useMemo(() => {
    if (!hasSearchQuery) return data.todas
    return data.todas.filter((row) =>
      textMatchesSearch(
        normalizedSearchQuery,
        row.todaId,
        row.todaName,
        row.barangayId,
        row.barangayName,
        row.status,
        row.driverCount,
        row.tricycleCount,
        row.createdAt
      )
    )
  }, [data.todas, hasSearchQuery, normalizedSearchQuery])

  const filteredRoutes = useMemo(() => {
    if (!hasSearchQuery) return data.routes
    return data.routes.filter((row) =>
      textMatchesSearch(
        normalizedSearchQuery,
        row.routeId,
        row.origin,
        row.destination,
        row.defaultFareAmount,
        row.todaId,
        row.todaName,
        row.barangayName,
        row.status,
        row.createdAt
      )
    )
  }, [data.routes, hasSearchQuery, normalizedSearchQuery])

  const filteredAdministrators = useMemo(() => {
    if (!hasSearchQuery) return data.administrators
    return data.administrators.filter((row) =>
      textMatchesSearch(
        normalizedSearchQuery,
        row.adminId,
        row.email,
        row.role,
        formatAdministratorScope(row),
        row.status,
        row.barangayId,
        row.barangayName,
        row.todaId,
        row.todaName,
        row.city,
        row.createdAt
      )
    )
  }, [data.administrators, hasSearchQuery, normalizedSearchQuery])

  const filteredDrivers = useMemo(() => {
    if (!hasSearchQuery) return data.drivers
    return data.drivers.filter((row) =>
      textMatchesSearch(
        normalizedSearchQuery,
        row.driverId,
        row.driverCode,
        `${row.firstName} ${row.lastName}`,
        row.firstName,
        row.lastName,
        row.contactNo,
        row.tricycleId,
        row.tricycleNo,
        row.qrId,
        row.qrStatus,
        row.todaId,
        row.todaName,
        row.barangayName,
        row.passwordSet ? "password set" : "password pending",
        row.status,
        row.createdAt
      )
    )
  }, [data.drivers, hasSearchQuery, normalizedSearchQuery])

  const filteredTricycles = useMemo(() => {
    if (!hasSearchQuery) return data.tricycles
    return data.tricycles.filter((row) =>
      textMatchesSearch(
        normalizedSearchQuery,
        row.tricycleId,
        row.plateNo,
        row.regNo,
        row.permitExpirationDate,
        row.todaId,
        row.todaName,
        row.barangayName,
        row.status,
        row.createdAt
      )
    )
  }, [data.tricycles, hasSearchQuery, normalizedSearchQuery])

  const totalRecordsManaged =
    data.administrators.length +
    data.barangays.length +
    data.todas.length +
    data.drivers.length +
    data.tricycles.length +
    data.routes.length

  const resetNotice = () => {
    setNotice(null)
    setError(null)
  }

  const closeModal = () => {
    setActiveModal(null)
  }

  const closeDeleteDialog = () => {
    setPendingDelete(null)
  }

  const withBusyState = async (key: string, action: () => Promise<void>) => {
    setBusyKey(key)
    setNotice(null)
    setError(null)
    try {
      await action()
    } catch (actionError) {
      setError(String(actionError))
    } finally {
      setBusyKey(null)
    }
  }

  const openBarangayCreateModal = () => {
    resetNotice()
    setBarangayForm(createBarangayForm())
    setActiveModal({ entity: "barangay", mode: "create" })
  }

  const openBarangayEditModal = (row: BarangayRecord) => {
    resetNotice()
    setBarangayForm({
      barangayName: row.barangayName,
      district: row.district ?? "",
      city: row.city,
      status: row.status
    })
    setActiveModal({ entity: "barangay", mode: "edit", id: row.barangayId })
  }

  const openTodaCreateModal = () => {
    resetNotice()
    setTodaForm(createTodaForm())
    setActiveModal({ entity: "toda", mode: "create" })
  }

  const openTodaEditModal = (row: TodaRecord) => {
    resetNotice()
    setTodaForm({
      barangayId: String(row.barangayId),
      todaName: row.todaName,
      status: row.status
    })
    setActiveModal({ entity: "toda", mode: "edit", id: row.todaId })
  }

  const openRouteCreateModal = () => {
    resetNotice()
    setRouteForm(createRouteForm())
    setActiveModal({ entity: "route", mode: "create" })
  }

  const openRouteEditModal = (row: RouteRecord) => {
    resetNotice()
    setRouteForm({
      todaId: String(row.todaId),
      origin: row.origin,
      destination: row.destination,
      defaultFareAmount:
        row.defaultFareAmount === undefined ? "" : String(row.defaultFareAmount),
      geofenceGeojsonText: row.geofenceGeojson
        ? JSON.stringify(row.geofenceGeojson, null, 2)
        : "",
      status: row.status
    })
    setActiveModal({ entity: "route", mode: "edit", id: row.routeId })
  }

  const openAdministratorCreateModal = () => {
    resetNotice()
    setAdministratorForm(createAdministratorForm())
    setActiveModal({ entity: "administrator", mode: "create" })
  }

  const openAdministratorEditModal = (row: AdministratorRecord) => {
    resetNotice()
    setAdministratorForm({
      adminId: row.adminId,
      email: row.email,
      password: "",
      role: row.role,
      barangayId: row.barangayId ? String(row.barangayId) : "",
      todaId: row.todaId ? String(row.todaId) : "",
      status: row.status
    })
    setActiveModal({ entity: "administrator", mode: "edit", id: row.adminId })
  }

  const openDeleteAdministratorDialog = (row: AdministratorRecord) => {
    setPendingDelete({
      entity: "administrator",
      id: row.adminId,
      title: `Delete admin access for ${row.email}?`,
      description:
        "This removes the dashboard administrator access link. The Supabase Auth user login remains available unless it is removed separately in Supabase.",
      confirmLabel: "Delete Admin"
    })
  }

  const handleCreateDriver = async () => {
    await withBusyState("create-driver", async () => {
      const item = await createMasterDataItem<DriverRecord>(accessToken, "driver", {
        todaId: Number(driverForm.todaId),
        tricycleId: driverForm.tricycleId ? Number(driverForm.tricycleId) : undefined,
        qrId: driverForm.qrId ? Number(driverForm.qrId) : undefined,
        firstName: driverForm.firstName,
        lastName: driverForm.lastName,
        contactNo: driverForm.contactNo || undefined
      })

      await loadMasterData()
      setDriverForm({
        todaId: lockedTodaId ? String(lockedTodaId) : driverForm.todaId,
        tricycleId: "",
        qrId: "",
        firstName: "",
        lastName: "",
        contactNo: ""
      })
      setNotice(`Added driver ${item.firstName} ${item.lastName}.`)
      onDataChanged?.()
    })
  }

  const handleCreateTricycle = async () => {
    await withBusyState("create-tricycle", async () => {
      const item = await createMasterDataItem<TricycleRecord>(accessToken, "tricycle", {
        todaId: Number(tricycleForm.todaId),
        plateNo: tricycleForm.plateNo,
        regNo: tricycleForm.regNo || undefined,
        permitExpirationDate: tricycleForm.permitExpirationDate || undefined
      })

      await loadMasterData()
      setTricycleForm({
        todaId: lockedTodaId ? String(lockedTodaId) : tricycleForm.todaId,
        plateNo: "",
        regNo: "",
        permitExpirationDate: ""
      })
      setNotice(`Added tricycle ${item.plateNo}.`)
      onDataChanged?.()
    })
  }

  const submitSuperadminModal = async () => {
    if (!activeModal) return

    if (activeModal.entity === "administrator") {
      const isCreate = activeModal.mode === "create"
      const nextBusyKey = isCreate ? "create-administrator" : `save-administrator-${activeModal.id}`

      await withBusyState(nextBusyKey, async () => {
        const payload = {
          email: administratorForm.email.trim(),
          password: administratorForm.password.trim() || undefined,
          role: administratorForm.role,
          barangayId:
            administratorForm.role === "barangay_admin"
              ? Number(administratorForm.barangayId)
              : null,
          todaId:
            administratorForm.role === "toda_admin"
              ? Number(administratorForm.todaId)
              : null,
          status: administratorForm.status
        }

        const item = isCreate
          ? await createMasterDataItem<AdministratorRecord>(accessToken, "administrator", payload)
          : await updateMasterDataItem<AdministratorRecord>(
              accessToken,
              "administrator",
              activeModal.id!,
              payload
            )

        await loadMasterData()
        setNotice(`${isCreate ? "Added" : "Updated"} administrator ${item.email}.`)
        closeModal()
        onDataChanged?.()
      })
      return
    }

    if (activeModal.entity === "barangay") {
      const isCreate = activeModal.mode === "create"
      const nextBusyKey = isCreate ? "create-barangay" : `save-barangay-${activeModal.id}`

      await withBusyState(nextBusyKey, async () => {
        if (isCreate) {
          const item = await createMasterDataItem<BarangayRecord>(accessToken, "barangay", {
            barangayName: barangayForm.barangayName,
            district: barangayForm.district || undefined,
            city: barangayForm.city
          })
          await loadMasterData()
          setNotice(`Added barangay ${item.barangayName}.`)
        } else {
          const item = await updateMasterDataItem<BarangayRecord>(
            accessToken,
            "barangay",
            activeModal.id!,
            {
              barangayName: barangayForm.barangayName,
              district: barangayForm.district || undefined,
              city: barangayForm.city,
              status: barangayForm.status
            }
          )
          await loadMasterData()
          setNotice(`Updated barangay ${item.barangayName}.`)
        }

        closeModal()
        onDataChanged?.()
      })

      return
    }

    if (activeModal.entity === "toda") {
      const isCreate = activeModal.mode === "create"
      const nextBusyKey = isCreate ? "create-toda" : `save-toda-${activeModal.id}`

      await withBusyState(nextBusyKey, async () => {
        if (isCreate) {
          const item = await createMasterDataItem<TodaRecord>(accessToken, "toda", {
            barangayId: Number(todaForm.barangayId),
            todaName: todaForm.todaName
          })
          await loadMasterData()
          setNotice(`Added TODA ${item.todaName}.`)
        } else {
          const item = await updateMasterDataItem<TodaRecord>(accessToken, "toda", activeModal.id!, {
            barangayId: Number(todaForm.barangayId),
            todaName: todaForm.todaName,
            status: todaForm.status
          })
          await loadMasterData()
          setNotice(`Updated TODA ${item.todaName}.`)
        }

        closeModal()
        onDataChanged?.()
      })

      return
    }

    if (activeModal.entity === "route") {
      const isCreate = activeModal.mode === "create"
      const nextBusyKey = isCreate ? "create-route" : `save-route-${activeModal.id}`

      await withBusyState(nextBusyKey, async () => {
        const hasGeofenceText = routeForm.geofenceGeojsonText.trim().length > 0
        const parsedGeofence = hasGeofenceText
          ? JSON.parse(routeForm.geofenceGeojsonText)
          : isCreate
            ? undefined
            : null

        if (isCreate) {
          const item = await createMasterDataItem<RouteRecord>(accessToken, "route", {
            todaId: Number(routeForm.todaId),
            origin: routeForm.origin,
            destination: routeForm.destination,
            defaultFareAmount: routeForm.defaultFareAmount.trim()
              ? Number(routeForm.defaultFareAmount)
              : null,
            geofenceGeojson: parsedGeofence
          })
          await loadMasterData()
          setNotice(`Added route ${item.origin} -> ${item.destination}.`)
        } else {
          const item = await updateMasterDataItem<RouteRecord>(accessToken, "route", activeModal.id!, {
            todaId: Number(routeForm.todaId),
            origin: routeForm.origin,
            destination: routeForm.destination,
            defaultFareAmount: routeForm.defaultFareAmount.trim()
              ? Number(routeForm.defaultFareAmount)
              : null,
            geofenceGeojson: parsedGeofence,
            status: routeForm.status
          })
          await loadMasterData()
          setNotice(`Updated route ${item.origin} -> ${item.destination}.`)
        }

        closeModal()
        onDataChanged?.()
      })
    }
  }

  const openDeleteBarangayDialog = (row: BarangayRecord) => {
    setPendingDelete({
      entity: "barangay",
      id: row.barangayId,
      title: `Delete barangay ${row.barangayName}?`,
      description: "The barangay record will be permanently removed from settings.",
      confirmLabel: "Delete Barangay"
    })
  }

  const openDeleteTodaDialog = (row: TodaRecord) => {
    setPendingDelete({
      entity: "toda",
      id: row.todaId,
      title: `Delete TODA ${row.todaName}?`,
      description: "The TODA record will be permanently removed from settings.",
      confirmLabel: "Delete TODA"
    })
  }

  const openDeleteRouteDialog = (row: RouteRecord) => {
    setPendingDelete({
      entity: "route",
      id: row.routeId,
      title: `Delete route ${row.origin} -> ${row.destination}?`,
      description: "The route will be permanently removed from settings.",
      confirmLabel: "Delete Route"
    })
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return

    const deleteKey = `delete-${pendingDelete.entity}-${pendingDelete.id}`
    await withBusyState(deleteKey, async () => {
      await deleteMasterDataItem(accessToken, pendingDelete.entity, pendingDelete.id)
      await loadMasterData()

      if (pendingDelete.entity === "administrator") {
        setNotice("Deleted administrator access.")
      } else if (pendingDelete.entity === "barangay") {
        setNotice("Deleted barangay.")
      } else if (pendingDelete.entity === "toda") {
        setNotice("Deleted TODA.")
      } else {
        setNotice("Deleted route.")
      }

      if (activeModal?.entity === pendingDelete.entity && activeModal.id === pendingDelete.id) {
        closeModal()
      }

      closeDeleteDialog()
      onDataChanged?.()
    })
  }

  const updateDriverDraft = (driverId: number, patch: Partial<DriverRecord>) => {
    resetNotice()
    setData((current) => ({
      ...current,
      drivers: current.drivers.map((item) =>
        item.driverId === driverId ? { ...item, ...patch } : item
      )
    }))
  }

  const updateTricycleDraft = (tricycleId: number, patch: Partial<TricycleRecord>) => {
    resetNotice()
    setData((current) => ({
      ...current,
      tricycles: current.tricycles.map((item) =>
        item.tricycleId === tricycleId ? { ...item, ...patch } : item
      )
    }))
  }

  const saveDriver = async (row: DriverRecord) => {
    await withBusyState(`driver-${row.driverId}`, async () => {
      await updateMasterDataItem<DriverRecord>(accessToken, "driver", row.driverId, {
        todaId: row.todaId,
        tricycleId: row.tricycleId,
        qrId: row.qrId,
        firstName: row.firstName,
        lastName: row.lastName,
        contactNo: row.contactNo || undefined,
        status: row.status
      })
      await loadMasterData()
      setNotice(`Updated driver ${row.firstName} ${row.lastName}.`)
      onDataChanged?.()
    })
  }

  const saveTricycle = async (row: TricycleRecord) => {
    await withBusyState(`tricycle-${row.tricycleId}`, async () => {
      await updateMasterDataItem<TricycleRecord>(accessToken, "tricycle", row.tricycleId, {
        todaId: row.todaId,
        plateNo: row.plateNo,
        regNo: row.regNo || undefined,
        permitExpirationDate: row.permitExpirationDate || undefined,
        status: row.status
      })
      await loadMasterData()
      setNotice(`Updated tricycle ${row.plateNo}.`)
      onDataChanged?.()
    })
  }

  const modalBusyKey = activeModal
    ? activeModal.mode === "create"
      ? `create-${activeModal.entity}`
      : `save-${activeModal.entity}-${activeModal.id}`
    : null
  const routeDefaultFareInvalid =
    routeForm.defaultFareAmount.trim().length > 0 &&
    (!Number.isFinite(Number(routeForm.defaultFareAmount)) ||
      Number(routeForm.defaultFareAmount) < 0)

  const modalSubmitDisabled = !activeModal
    ? true
    : activeModal.entity === "administrator"
      ? !administratorForm.email.trim() ||
        (administratorForm.password.trim().length > 0 &&
          !isStrongTemporaryPassword(administratorForm.password.trim())) ||
        (administratorForm.role === "barangay_admin"
          ? !administratorForm.barangayId
          : administratorForm.role === "toda_admin"
            ? !administratorForm.todaId
            : false)
      : activeModal.entity === "barangay"
        ? !barangayForm.barangayName.trim() || !barangayForm.city.trim()
        : activeModal.entity === "toda"
          ? !todaForm.barangayId || !todaForm.todaName.trim()
          : !routeForm.todaId ||
            !routeForm.origin.trim() ||
            !routeForm.destination.trim() ||
            routeDefaultFareInvalid

  const modalTitle = !activeModal
    ? ""
    : activeModal.entity === "administrator"
      ? activeModal.mode === "create"
        ? "Add Administrator"
        : "Edit Administrator"
      : activeModal.entity === "barangay"
        ? activeModal.mode === "create"
          ? "Add Barangay"
          : "Edit Barangay"
        : activeModal.entity === "toda"
          ? activeModal.mode === "create"
            ? "Add TODA"
            : "Edit TODA"
          : activeModal.mode === "create"
            ? "Add Route"
            : "Edit Route"

  const modalDescription = !activeModal
    ? ""
    : activeModal.entity === "administrator"
      ? activeModal.mode === "create"
        ? "Create or link an authenticated admin account, then assign its role and access scope."
        : "Adjust role access, scope, and account status for this administrator."
      : activeModal.entity === "barangay"
        ? activeModal.mode === "create"
          ? "Create a barangay record for the settings workspace."
          : "Update barangay details and availability."
        : activeModal.entity === "toda"
          ? activeModal.mode === "create"
            ? "Create a TODA and assign it to a barangay."
            : "Update the TODA assignment and status."
          : activeModal.mode === "create"
            ? "Create a route for a TODA."
            : "Update route details, status, and geofence."

  const modalSubmitLabel = activeModal
    ? busyKey === modalBusyKey
      ? "Saving..."
      : activeModal.mode === "create"
        ? `Create ${formatEntityLabel(activeModal.entity)}`
        : "Save Changes"
    : "Save"

  if (isTodaAdminMode) {
    return (
      <section className="superadmin-page">
        <header className="superadmin-hero">
          <div>
            <div className="superadmin-hero__eyebrow">Operations</div>
            <h2>TODA Operations</h2>
            <p>Manage drivers and tricycles for {lockedTodaLabel ?? "your assigned TODA"}.</p>
          </div>
          <button
            type="button"
            className={`superadmin-refresh-button ${
              loading ? "superadmin-refresh-button--loading" : ""
            }`}
            onClick={() => void loadMasterData()}
            disabled={loading}
            aria-label={loading ? "Refreshing TODA operations" : "Refresh TODA operations"}
            title={loading ? "Refreshing TODA operations" : "Refresh TODA operations"}
          >
            <RefreshIcon />
          </button>
        </header>

        {(error || notice) && (
          <div className={`superadmin-banner ${error ? "superadmin-banner--error" : ""}`}>
            {error ?? notice}
          </div>
        )}

        <section className="superadmin-create-grid">
          <article className="superadmin-surface superadmin-form-card">
            <div className="superadmin-table-card__header">
              <div>
                <h3>Add Driver</h3>
                <p>Register a driver and connect the record to a tricycle when available.</p>
              </div>
            </div>
            <select
              value={driverForm.todaId}
              onChange={(event) =>
                setDriverForm((current) => ({ ...current, todaId: event.target.value }))
              }
              disabled={isTodaAdminMode}
            >
              <option value="">Select TODA</option>
              {todaOptions.map((toda) => (
                <option key={toda.todaId} value={toda.todaId}>
                  {toda.barangayName} - {toda.todaName}
                </option>
              ))}
            </select>
            <select
              value={driverForm.tricycleId}
              onChange={(event) =>
                setDriverForm((current) => ({ ...current, tricycleId: event.target.value }))
              }
            >
              <option value="">Assign tricycle</option>
              {tricycleOptions.map((tricycle) => (
                <option key={tricycle.tricycleId} value={tricycle.tricycleId}>
                  {tricycle.barangayName} - {tricycle.todaName} - {tricycle.plateNo}
                </option>
              ))}
            </select>
            <input
              value={driverForm.qrId}
              onChange={(event) =>
                setDriverForm((current) => ({ ...current, qrId: event.target.value }))
              }
              placeholder="QR ID"
            />
            <input
              value={driverForm.firstName}
              onChange={(event) =>
                setDriverForm((current) => ({ ...current, firstName: event.target.value }))
              }
              placeholder="First name"
            />
            <input
              value={driverForm.lastName}
              onChange={(event) =>
                setDriverForm((current) => ({ ...current, lastName: event.target.value }))
              }
              placeholder="Last name"
            />
            <input
              value={driverForm.contactNo}
              onChange={(event) =>
                setDriverForm((current) => ({ ...current, contactNo: event.target.value }))
              }
              placeholder="Contact number"
            />
            <button
              type="button"
              className="superadmin-primary-button"
              onClick={() => void handleCreateDriver()}
              disabled={
                busyKey === "create-driver" ||
                !driverForm.todaId ||
                !driverForm.firstName ||
                !driverForm.lastName
              }
            >
              {busyKey === "create-driver" ? "Saving..." : "Create Driver"}
            </button>
          </article>

          <article className="superadmin-surface superadmin-form-card">
            <div className="superadmin-table-card__header">
              <div>
                <h3>Add Tricycle</h3>
                <p>Register a unit for your TODA and track permit details in one place.</p>
              </div>
            </div>
            <select
              value={tricycleForm.todaId}
              onChange={(event) =>
                setTricycleForm((current) => ({ ...current, todaId: event.target.value }))
              }
              disabled={isTodaAdminMode}
            >
              <option value="">Select TODA</option>
              {todaOptions.map((toda) => (
                <option key={toda.todaId} value={toda.todaId}>
                  {toda.barangayName} - {toda.todaName}
                </option>
              ))}
            </select>
            <input
              value={tricycleForm.plateNo}
              onChange={(event) =>
                setTricycleForm((current) => ({ ...current, plateNo: event.target.value }))
              }
              placeholder="Plate no"
            />
            <input
              value={tricycleForm.regNo}
              onChange={(event) =>
                setTricycleForm((current) => ({ ...current, regNo: event.target.value }))
              }
              placeholder="Registration no"
            />
            <input
              type="date"
              value={tricycleForm.permitExpirationDate}
              onChange={(event) =>
                setTricycleForm((current) => ({
                  ...current,
                  permitExpirationDate: event.target.value
                }))
              }
            />
            <button
              type="button"
              className="superadmin-primary-button"
              onClick={() => void handleCreateTricycle()}
              disabled={busyKey === "create-tricycle" || !tricycleForm.todaId || !tricycleForm.plateNo}
            >
              {busyKey === "create-tricycle" ? "Saving..." : "Create Tricycle"}
            </button>
          </article>
        </section>

        <section className="superadmin-surface superadmin-table-card">
          <div className="superadmin-table-card__header">
            <div>
              <h3>Drivers</h3>
              <p>Maintain the driver records available to your TODA mobile units.</p>
            </div>
          </div>
          <div className="superadmin-table-scroll">
            <table className="superadmin-data-table">
              <thead>
                <tr>
                  <th>Tricycle</th>
                  <th>QR ID</th>
                  <th>First name</th>
                  <th>Last name</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Password</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="superadmin-empty-state">
                        {hasSearchQuery
                          ? `No drivers match "${searchQuery.trim()}".`
                          : "No drivers have been added to this TODA yet."}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredDrivers.map((row) => (
                    <tr key={row.driverId}>
                      <td>
                        <select
                          value={row.tricycleId ?? ""}
                          onChange={(event) => {
                            const tricycleId = event.target.value
                              ? Number(event.target.value)
                              : undefined
                            const tricycle = data.tricycles.find(
                              (item) => item.tricycleId === tricycleId
                            )
                            updateDriverDraft(row.driverId, {
                              tricycleId,
                              tricycleNo: tricycle?.plateNo ?? row.tricycleNo
                            })
                          }}
                        >
                          <option value="">Assign tricycle</option>
                          {tricycleOptions.map((tricycle) => (
                            <option key={tricycle.tricycleId} value={tricycle.tricycleId}>
                              {tricycle.barangayName} - {tricycle.todaName} - {tricycle.plateNo}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          value={row.qrId ?? ""}
                          onChange={(event) =>
                            updateDriverDraft(row.driverId, {
                              qrId: event.target.value ? Number(event.target.value) : undefined
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={row.firstName}
                          onChange={(event) =>
                            updateDriverDraft(row.driverId, { firstName: event.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={row.lastName}
                          onChange={(event) =>
                            updateDriverDraft(row.driverId, { lastName: event.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={row.contactNo ?? ""}
                          onChange={(event) =>
                            updateDriverDraft(row.driverId, { contactNo: event.target.value })
                          }
                        />
                      </td>
                      <td>
                        <select
                          value={row.status}
                          onChange={(event) =>
                            updateDriverDraft(row.driverId, {
                              status: event.target.value as EntityStatus
                            })
                          }
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {formatStatusLabel(status)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className="superadmin-badge">
                          {row.passwordSet ? "Set" : "Pending"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="superadmin-primary-button superadmin-primary-button--compact"
                          onClick={() => void saveDriver(row)}
                          disabled={busyKey === `driver-${row.driverId}`}
                        >
                          {busyKey === `driver-${row.driverId}` ? "Saving..." : "Save"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="superadmin-surface superadmin-table-card">
          <div className="superadmin-table-card__header">
            <div>
              <h3>Tricycles</h3>
              <p>Manage the units assigned to your TODA.</p>
            </div>
          </div>
          <div className="superadmin-table-scroll">
            <table className="superadmin-data-table">
              <thead>
                <tr>
                  <th>Plate no</th>
                  <th>Reg no</th>
                  <th>Permit exp.</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredTricycles.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="superadmin-empty-state">
                        {hasSearchQuery
                          ? `No tricycles match "${searchQuery.trim()}".`
                          : "No tricycles have been added to this TODA yet."}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTricycles.map((row) => (
                    <tr key={row.tricycleId}>
                      <td>
                        <input
                          value={row.plateNo}
                          onChange={(event) =>
                            updateTricycleDraft(row.tricycleId, { plateNo: event.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={row.regNo ?? ""}
                          onChange={(event) =>
                            updateTricycleDraft(row.tricycleId, { regNo: event.target.value })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          value={toDateInputValue(row.permitExpirationDate)}
                          onChange={(event) =>
                            updateTricycleDraft(row.tricycleId, {
                              permitExpirationDate: event.target.value
                            })
                          }
                        />
                      </td>
                      <td>
                        <select
                          value={row.status}
                          onChange={(event) =>
                            updateTricycleDraft(row.tricycleId, {
                              status: event.target.value as EntityStatus
                            })
                          }
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {formatStatusLabel(status)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="superadmin-primary-button superadmin-primary-button--compact"
                          onClick={() => void saveTricycle(row)}
                          disabled={busyKey === `tricycle-${row.tricycleId}`}
                        >
                          {busyKey === `tricycle-${row.tricycleId}` ? "Saving..." : "Save"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    )
  }

  return (
    <section className="superadmin-page">
      <div className="superadmin-page__static">
        <header className="superadmin-hero superadmin-hero--actions-only">
          <button
            type="button"
            className={`superadmin-refresh-button ${
              loading ? "superadmin-refresh-button--loading" : ""
            }`}
            onClick={() => void loadMasterData()}
            disabled={loading}
            aria-label={loading ? "Refreshing settings" : "Refresh settings"}
            title={loading ? "Refreshing settings" : "Refresh settings"}
          >
            <RefreshIcon />
          </button>
        </header>

        <section className="superadmin-summary">
          <article className="superadmin-surface superadmin-stat">
            <span>Administrators</span>
            <strong>{data.administrators.length}</strong>
            <small>Existing linked admin accounts</small>
          </article>
          <article className="superadmin-surface superadmin-stat">
            <span>Barangays</span>
            <strong>{data.barangays.length}</strong>
            <small>Location groups ready for assignment</small>
          </article>
          <article className="superadmin-surface superadmin-stat">
            <span>TODAs</span>
            <strong>{data.todas.length}</strong>
            <small>Registered transport groups</small>
          </article>
          <article className="superadmin-surface superadmin-stat">
            <span>Routes</span>
            <strong>{data.routes.length}</strong>
            <small>Published travel definitions</small>
          </article>
          <article className="superadmin-surface superadmin-stat">
            <span>Total records</span>
            <strong>{totalRecordsManaged}</strong>
            <small>Across admins, fleets, and coverage</small>
          </article>
        </section>

        {(error || notice) && (
          <div className={`superadmin-banner ${error ? "superadmin-banner--error" : ""}`}>
            {error ?? notice}
          </div>
        )}

        <section className="superadmin-surface superadmin-tabs">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`superadmin-tab ${tab.key === activeTab ? "superadmin-tab--active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </section>
      </div>

      <div className="superadmin-page__content">
        {activeTab === "admin-panel" && (
          <section className="superadmin-surface superadmin-table-card">
            <div className="superadmin-table-card__header">
              <div>
                <h3>Admin Panel</h3>
              </div>
            </div>
            <div className="superadmin-table-scroll">
              <table className="superadmin-data-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Name</th>
                    <th>Scope</th>
                    <th>Added</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecentActivity.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="superadmin-empty-state">
                          {hasSearchQuery
                            ? `No settings records match "${searchQuery.trim()}".`
                            : "No settings records are available yet."}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRecentActivity.map((item) => (
                      <tr key={item.key}>
                        <td>
                          <span className="superadmin-category-chip">{item.category}</span>
                        </td>
                        <td>{item.title}</td>
                        <td>{item.scope}</td>
                        <td>{formatDateLabel(item.createdAt)}</td>
                        <td>
                          <span className={`superadmin-status superadmin-status--${item.status}`}>
                            {formatStatusLabel(item.status)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === "barangays" && (
          <section className="superadmin-surface superadmin-table-card">
            <div className="superadmin-table-card__header">
              <div>
                <h3>Barangays</h3>
                <p>Modify the location scope available to administrators and TODAs.</p>
              </div>
              <button
                type="button"
                className="superadmin-primary-button"
                onClick={openBarangayCreateModal}
              >
                Add Barangay
              </button>
            </div>
            <div className="superadmin-table-scroll">
              <table className="superadmin-data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>District</th>
                    <th>City</th>
                    <th>TODAs</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredBarangays.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="superadmin-empty-state">
                          {hasSearchQuery
                            ? `No barangays match "${searchQuery.trim()}".`
                            : "No barangays added yet."}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredBarangays.map((row) => {
                      const rowBusy =
                        busyKey === `save-barangay-${row.barangayId}` ||
                        busyKey === `delete-barangay-${row.barangayId}`

                      return (
                        <tr key={row.barangayId}>
                          <td>{row.barangayName}</td>
                          <td>{row.district || "Not set"}</td>
                          <td>{row.city}</td>
                          <td>
                            <span className="superadmin-badge">{row.todaCount}</span>
                          </td>
                          <td>
                            <span className={`superadmin-status superadmin-status--${row.status}`}>
                              {formatStatusLabel(row.status)}
                            </span>
                          </td>
                          <td>
                            <div className="superadmin-row-actions">
                              <button
                                type="button"
                                className="superadmin-secondary-button"
                                onClick={() => openBarangayEditModal(row)}
                                disabled={rowBusy}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="superadmin-danger-button"
                                onClick={() => openDeleteBarangayDialog(row)}
                                disabled={rowBusy}
                              >
                                {busyKey === `delete-barangay-${row.barangayId}`
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

      {activeTab === "todas" && (
        <section className="superadmin-surface superadmin-table-card">
          <div className="superadmin-table-card__header">
            <div>
              <h3>TODAs</h3>
              <p>Assign TODAs to barangays and monitor their fleet readiness.</p>
            </div>
            <button
              type="button"
              className="superadmin-primary-button"
              onClick={openTodaCreateModal}
              disabled={barangayOptions.length === 0}
            >
              Add TODA
            </button>
          </div>
          <div className="superadmin-table-scroll">
            <table className="superadmin-data-table">
              <thead>
                <tr>
                  <th>Barangay</th>
                  <th>TODA</th>
                  <th>Drivers</th>
                  <th>Tricycles</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredTodas.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="superadmin-empty-state">
                        {hasSearchQuery
                          ? `No TODAs match "${searchQuery.trim()}".`
                          : "No TODAs added yet."}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTodas.map((row) => {
                    const rowBusy =
                      busyKey === `save-toda-${row.todaId}` || busyKey === `delete-toda-${row.todaId}`

                    return (
                      <tr key={row.todaId}>
                        <td>{row.barangayName}</td>
                        <td>{row.todaName}</td>
                        <td>
                          <span className="superadmin-badge">{row.driverCount}</span>
                        </td>
                        <td>
                          <span className="superadmin-badge">{row.tricycleCount}</span>
                        </td>
                        <td>
                          <span className={`superadmin-status superadmin-status--${row.status}`}>
                            {formatStatusLabel(row.status)}
                          </span>
                        </td>
                        <td>
                          <div className="superadmin-row-actions">
                            <button
                              type="button"
                              className="superadmin-secondary-button"
                              onClick={() => openTodaEditModal(row)}
                              disabled={rowBusy}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="superadmin-danger-button"
                              onClick={() => openDeleteTodaDialog(row)}
                              disabled={rowBusy}
                            >
                              {busyKey === `delete-toda-${row.todaId}` ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "routes" && (
        <section className="superadmin-surface superadmin-table-card">
          <div className="superadmin-table-card__header">
            <div>
              <h3>Routes</h3>
              <p>Keep route definitions current before connecting the mobile app.</p>
            </div>
            <button
              type="button"
              className="superadmin-primary-button"
              onClick={openRouteCreateModal}
              disabled={todaOptions.length === 0}
            >
              Add Route
            </button>
          </div>
          <div className="superadmin-table-scroll">
            <table className="superadmin-data-table">
              <thead>
                <tr>
                  <th>TODA</th>
                  <th>Origin</th>
                  <th>Destination</th>
                  <th>Default Fare</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredRoutes.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="superadmin-empty-state">
                        {hasSearchQuery
                          ? `No routes match "${searchQuery.trim()}".`
                          : "No routes added yet."}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRoutes.map((row) => {
                    const rowBusy =
                      busyKey === `save-route-${row.routeId}` ||
                      busyKey === `delete-route-${row.routeId}`

                    return (
                      <tr key={row.routeId}>
                        <td>{`${row.barangayName} / ${row.todaName}`}</td>
                        <td>{row.origin}</td>
                        <td>{row.destination}</td>
                        <td>{formatFareLabel(row.defaultFareAmount)}</td>
                        <td>
                          <span className={`superadmin-status superadmin-status--${row.status}`}>
                            {formatStatusLabel(row.status)}
                          </span>
                        </td>
                        <td>
                          <div className="superadmin-row-actions">
                            <button
                              type="button"
                              className="superadmin-secondary-button"
                              onClick={() => openRouteEditModal(row)}
                              disabled={rowBusy}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="superadmin-danger-button"
                              onClick={() => openDeleteRouteDialog(row)}
                              disabled={rowBusy}
                            >
                              {busyKey === `delete-route-${row.routeId}` ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "administrators" && (
        <section className="superadmin-surface superadmin-table-card">
          <div className="superadmin-table-card__header">
            <div>
              <h3>Administrators</h3>
              <p>Review linked admin accounts and organize access by role and scope.</p>
            </div>
            <button
              type="button"
              className="superadmin-primary-button"
              onClick={openAdministratorCreateModal}
            >
              Add Admin
            </button>
          </div>
          <div className="superadmin-table-scroll">
            <table className="superadmin-data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Scope</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredAdministrators.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="superadmin-empty-state">
                        {hasSearchQuery
                          ? `No administrators match "${searchQuery.trim()}".`
                          : "No administrator accounts are linked yet."}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAdministrators.map((row) => {
                    const rowBusy = busyKey === `delete-administrator-${row.adminId}`

                    return (
                      <tr key={row.adminId}>
                        <td>{row.email}</td>
                        <td>{formatRoleLabel(row.role)}</td>
                        <td>{formatAdministratorScope(row)}</td>
                        <td>
                          <span className={`superadmin-status superadmin-status--${row.status}`}>
                            {formatStatusLabel(row.status)}
                          </span>
                        </td>
                        <td>{formatDateLabel(row.createdAt)}</td>
                        <td>
                          <div className="superadmin-row-actions">
                            <button
                              type="button"
                              className="superadmin-secondary-button"
                              onClick={() => openAdministratorEditModal(row)}
                              disabled={rowBusy}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="superadmin-danger-button"
                              onClick={() => openDeleteAdministratorDialog(row)}
                              disabled={rowBusy}
                            >
                              {rowBusy ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      </div>

      {activeModal && (
        <div className="superadmin-modal-backdrop" role="presentation" onClick={closeModal}>
          <div
            className="superadmin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="superadmin-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="superadmin-modal__header">
              <div>
                <h3 id="superadmin-modal-title">{modalTitle}</h3>
                <p>{modalDescription}</p>
              </div>
              <button
                type="button"
                className="superadmin-modal__close"
                onClick={closeModal}
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>

            <div className="superadmin-modal__body">
              {activeModal.entity === "administrator" && (
                <>
                  <label className="superadmin-field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={administratorForm.email}
                      onChange={(event) =>
                        setAdministratorForm((current) => ({
                          ...current,
                          email: event.target.value
                        }))
                      }
                      placeholder="Use a valid email, e.g. admin@example.com"
                      readOnly={activeModal.mode === "edit"}
                    />
                    {activeModal.mode === "create" && (
                      <small>
                        Enter a real email address for the admin account, such as name@example.com.
                      </small>
                    )}
                  </label>
                  {activeModal.mode === "create" && (
                    <label className="superadmin-field">
                      <span>Temporary Password</span>
                      <input
                        type="password"
                        minLength={8}
                        value={administratorForm.password}
                        onChange={(event) =>
                          setAdministratorForm((current) => ({
                            ...current,
                            password: event.target.value
                          }))
                        }
                        placeholder="Strong password"
                      />
                      <small>
                        Use a strong password with at least 8 characters, uppercase, lowercase,
                        and a number. Leave blank only to link an existing authenticated user.
                      </small>
                    </label>
                  )}
                  <label className="superadmin-field">
                    <span>Role</span>
                    <select
                      value={administratorForm.role}
                      onChange={(event) => {
                        const nextRole = event.target.value as AdministratorRole
                        setAdministratorForm((current) => ({
                          ...current,
                          role: nextRole,
                          barangayId: nextRole === "barangay_admin" ? current.barangayId : "",
                          todaId: nextRole === "toda_admin" ? current.todaId : ""
                        }))
                      }}
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {formatRoleLabel(role)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {administratorForm.role === "barangay_admin" && (
                    <label className="superadmin-field">
                      <span>Barangay</span>
                      <select
                        value={administratorForm.barangayId}
                        onChange={(event) =>
                          setAdministratorForm((current) => ({
                            ...current,
                            barangayId: event.target.value
                          }))
                        }
                      >
                        <option value="">Select barangay</option>
                        {barangayOptions.map((barangay) => (
                          <option key={barangay.barangayId} value={barangay.barangayId}>
                            {barangay.barangayName}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {administratorForm.role === "toda_admin" && (
                    <label className="superadmin-field">
                      <span>TODA</span>
                      <select
                        value={administratorForm.todaId}
                        onChange={(event) =>
                          setAdministratorForm((current) => ({
                            ...current,
                            todaId: event.target.value
                          }))
                        }
                      >
                        <option value="">Select TODA</option>
                        {todaOptions.map((toda) => (
                          <option key={toda.todaId} value={toda.todaId}>
                            {toda.barangayName} - {toda.todaName}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="superadmin-field">
                    <span>Status</span>
                    <select
                      value={administratorForm.status}
                      onChange={(event) =>
                        setAdministratorForm((current) => ({
                          ...current,
                          status: event.target.value as EntityStatus
                        }))
                      }
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {formatStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}

              {activeModal.entity === "barangay" && (
                <>
                  <label className="superadmin-field">
                    <span>Barangay Name</span>
                    <input
                      value={barangayForm.barangayName}
                      onChange={(event) =>
                        setBarangayForm((current) => ({
                          ...current,
                          barangayName: event.target.value
                        }))
                      }
                      placeholder="Barangay name"
                    />
                  </label>
                  <label className="superadmin-field">
                    <span>District</span>
                    <input
                      value={barangayForm.district}
                      onChange={(event) =>
                        setBarangayForm((current) => ({ ...current, district: event.target.value }))
                      }
                      placeholder="District"
                    />
                  </label>
                  <label className="superadmin-field">
                    <span>City</span>
                    <input
                      value={barangayForm.city}
                      onChange={(event) =>
                        setBarangayForm((current) => ({ ...current, city: event.target.value }))
                      }
                      placeholder="City"
                    />
                  </label>
                  {activeModal.mode === "edit" && (
                    <label className="superadmin-field">
                      <span>Status</span>
                      <select
                        value={barangayForm.status}
                        onChange={(event) =>
                          setBarangayForm((current) => ({
                            ...current,
                            status: event.target.value as EntityStatus
                          }))
                        }
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {formatStatusLabel(status)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </>
              )}

              {activeModal.entity === "toda" && (
                <>
                  <label className="superadmin-field">
                    <span>Barangay</span>
                    <select
                      value={todaForm.barangayId}
                      onChange={(event) =>
                        setTodaForm((current) => ({ ...current, barangayId: event.target.value }))
                      }
                    >
                      <option value="">Select barangay</option>
                      {barangayOptions.map((barangay) => (
                        <option key={barangay.barangayId} value={barangay.barangayId}>
                          {barangay.barangayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="superadmin-field">
                    <span>TODA Name</span>
                    <input
                      value={todaForm.todaName}
                      onChange={(event) =>
                        setTodaForm((current) => ({ ...current, todaName: event.target.value }))
                      }
                      placeholder="TODA name"
                    />
                  </label>
                  {activeModal.mode === "edit" && (
                    <label className="superadmin-field">
                      <span>Status</span>
                      <select
                        value={todaForm.status}
                        onChange={(event) =>
                          setTodaForm((current) => ({
                            ...current,
                            status: event.target.value as EntityStatus
                          }))
                        }
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {formatStatusLabel(status)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </>
              )}

              {activeModal.entity === "route" && (
                <>
                  <label className="superadmin-field">
                    <span>TODA</span>
                    <select
                      value={routeForm.todaId}
                      onChange={(event) =>
                        setRouteForm((current) => ({ ...current, todaId: event.target.value }))
                      }
                    >
                      <option value="">Select TODA</option>
                      {todaOptions.map((toda) => (
                        <option key={toda.todaId} value={toda.todaId}>
                          {toda.barangayName} - {toda.todaName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="superadmin-field">
                    <span>Origin</span>
                    <input
                      value={routeForm.origin}
                      onChange={(event) =>
                        setRouteForm((current) => ({ ...current, origin: event.target.value }))
                      }
                      placeholder="Origin"
                    />
                  </label>
                  <label className="superadmin-field">
                    <span>Destination</span>
                    <input
                      value={routeForm.destination}
                      onChange={(event) =>
                        setRouteForm((current) => ({
                          ...current,
                          destination: event.target.value
                        }))
                      }
                      placeholder="Destination"
                    />
                  </label>
                  <label className="superadmin-field">
                    <span>Default fare</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={routeForm.defaultFareAmount}
                      onChange={(event) =>
                        setRouteForm((current) => ({
                          ...current,
                          defaultFareAmount: event.target.value
                        }))
                      }
                      placeholder="Optional PHP amount"
                    />
                    <small>Used by the passenger QR fare checker before a trip is completed.</small>
                  </label>
                  <label className="superadmin-field">
                    <span>Geofence GeoJSON</span>
                    <textarea
                      rows={6}
                      value={routeForm.geofenceGeojsonText}
                      onChange={(event) =>
                        setRouteForm((current) => ({
                          ...current,
                          geofenceGeojsonText: event.target.value
                        }))
                      }
                      placeholder="Optional geofence GeoJSON"
                    />
                  </label>
                  {activeModal.mode === "edit" && (
                    <label className="superadmin-field">
                      <span>Status</span>
                      <select
                        value={routeForm.status}
                        onChange={(event) =>
                          setRouteForm((current) => ({
                            ...current,
                            status: event.target.value as EntityStatus
                          }))
                        }
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {formatStatusLabel(status)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </>
              )}
            </div>

            <div className="superadmin-modal__footer">
              <button
                type="button"
                className="superadmin-secondary-button"
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="superadmin-primary-button"
                onClick={() => void submitSuperadminModal()}
                disabled={modalSubmitDisabled || busyKey === modalBusyKey}
              >
                {modalSubmitLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        open={pendingDelete !== null}
        title={pendingDelete?.title ?? ""}
        description={pendingDelete?.description ?? ""}
        confirmLabel={pendingDelete?.confirmLabel ?? "Delete"}
        busy={pendingDelete ? busyKey === `delete-${pendingDelete.entity}-${pendingDelete.id}` : false}
        onConfirm={() => void confirmDelete()}
        onClose={closeDeleteDialog}
      />
    </section>
  )
}
