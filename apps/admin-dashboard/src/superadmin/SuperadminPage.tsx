import { useEffect, useMemo, useState } from "react"
import {
  createMasterDataItem,
  deleteMasterDataItem,
  fetchMasterData,
  updateMasterDataItem,
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
  onDataChanged?: () => void
}

type SuperadminModalEntity = "barangay" | "toda" | "route"

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
  geofenceGeojsonText: string
  status: EntityStatus
}

const STATUS_OPTIONS: EntityStatus[] = ["active", "inactive", "suspended"]

const initialMasterData: MasterDataSnapshot = {
  barangays: [],
  todas: [],
  drivers: [],
  tricycles: [],
  routes: []
}

const toDateInputValue = (value?: string) => (value ? value.slice(0, 10) : "")

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
  geofenceGeojsonText: "",
  status: "active"
})

const formatStatusLabel = (status: EntityStatus) =>
  status.charAt(0).toUpperCase() + status.slice(1)

const formatEntityLabel = (entity: SuperadminModalEntity) =>
  entity === "toda" ? "TODA" : entity.charAt(0).toUpperCase() + entity.slice(1)

export default function SuperadminPage({
  accessToken,
  mode = "superadmin",
  lockedTodaId,
  lockedTodaLabel,
  onDataChanged
}: SuperadminPageProps) {
  const isSuperadminMode = mode === "superadmin"
  const isTodaAdminMode = mode === "toda-admin"
  const [data, setData] = useState<MasterDataSnapshot>(initialMasterData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [activeModal, setActiveModal] = useState<SuperadminModalState | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteState | null>(null)

  const [barangayForm, setBarangayForm] = useState<BarangayFormState>(createBarangayForm)
  const [todaForm, setTodaForm] = useState<TodaFormState>(createTodaForm)
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
  const [routeForm, setRouteForm] = useState<RouteFormState>(createRouteForm)

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

  const todaOptions = useMemo(() => data.todas, [data.todas])
  const barangayOptions = useMemo(() => data.barangays, [data.barangays])
  const tricycleOptions = useMemo(() => data.tricycles, [data.tricycles])

  const totalAdminsManaged =
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
      geofenceGeojsonText: row.geofenceGeojson
        ? JSON.stringify(row.geofenceGeojson, null, 2)
        : "",
      status: row.status
    })
    setActiveModal({ entity: "route", mode: "edit", id: row.routeId })
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

    if (activeModal.entity === "barangay") {
      const isCreate = activeModal.mode === "create"
      const nextBusyKey = isCreate
        ? "create-barangay"
        : `save-barangay-${activeModal.id}`

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
            geofenceGeojson: parsedGeofence
          })
          await loadMasterData()
          setNotice(`Added route ${item.origin} -> ${item.destination}.`)
        } else {
          const item = await updateMasterDataItem<RouteRecord>(
            accessToken,
            "route",
            activeModal.id!,
            {
              todaId: Number(routeForm.todaId),
              origin: routeForm.origin,
              destination: routeForm.destination,
              geofenceGeojson: parsedGeofence,
              status: routeForm.status
            }
          )
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
      description: "The barangay record will be permanently removed from the system setup list.",
      confirmLabel: "Delete Barangay"
    })
  }

  const openDeleteTodaDialog = (row: TodaRecord) => {
    setPendingDelete({
      entity: "toda",
      id: row.todaId,
      title: `Delete TODA ${row.todaName}?`,
      description: "The TODA record will be permanently removed from the system setup list.",
      confirmLabel: "Delete TODA"
    })
  }

  const openDeleteRouteDialog = (row: RouteRecord) => {
    setPendingDelete({
      entity: "route",
      id: row.routeId,
      title: `Delete route ${row.origin} -> ${row.destination}?`,
      description: "The route will be permanently removed from the system setup list.",
      confirmLabel: "Delete Route"
    })
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return

    const deleteKey = `delete-${pendingDelete.entity}-${pendingDelete.id}`
    await withBusyState(deleteKey, async () => {
      await deleteMasterDataItem(accessToken, pendingDelete.entity, pendingDelete.id)
      await loadMasterData()

      if (pendingDelete.entity === "barangay") {
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

  const modalSubmitDisabled = !activeModal
    ? true
    : activeModal.entity === "barangay"
      ? !barangayForm.barangayName.trim() || !barangayForm.city.trim()
      : activeModal.entity === "toda"
        ? !todaForm.barangayId || !todaForm.todaName.trim()
        : !routeForm.todaId || !routeForm.origin.trim() || !routeForm.destination.trim()

  const modalTitle = !activeModal
    ? ""
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
    : activeModal.entity === "barangay"
      ? activeModal.mode === "create"
        ? "Create a barangay record for the system admin dashboard."
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

  return (
    <section className="superadmin-page">
      <header className="superadmin-hero">
        <div>
          <h2>{isSuperadminMode ? "System Setup" : "TODA Operations"}</h2>
          <p>
            {isSuperadminMode
              ? "Superadmin manages barangays, TODAs, and routes used across the whole system."
              : `Manage drivers and tricycles for ${lockedTodaLabel ?? "your assigned TODA"}.`}
          </p>
        </div>
        <button
          type="button"
          className="superadmin-refresh"
          onClick={() => void loadMasterData()}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      <section className="superadmin-summary">
        <article className="superadmin-stat">
          <span>Barangays</span>
          <strong>{data.barangays.length}</strong>
        </article>
        <article className="superadmin-stat">
          <span>TODAs</span>
          <strong>{data.todas.length}</strong>
        </article>
        <article className="superadmin-stat">
          <span>Drivers</span>
          <strong>{data.drivers.length}</strong>
        </article>
        <article className="superadmin-stat">
          <span>Tricycles</span>
          <strong>{data.tricycles.length}</strong>
        </article>
        <article className="superadmin-stat">
          <span>Routes</span>
          <strong>{data.routes.length}</strong>
        </article>
        <article className="superadmin-stat">
          <span>Total records</span>
          <strong>{totalAdminsManaged}</strong>
        </article>
      </section>

      {(error || notice) && (
        <div className={`superadmin-banner ${error ? "superadmin-banner--error" : ""}`}>
          {error ?? notice}
        </div>
      )}

      {isTodaAdminMode && (
        <section className="superadmin-create-grid">
          <article className="superadmin-card">
            <h3>Add Driver</h3>
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

          <article className="superadmin-card">
            <h3>Add Tricycle</h3>
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
              onClick={() => void handleCreateTricycle()}
              disabled={busyKey === "create-tricycle" || !tricycleForm.todaId || !tricycleForm.plateNo}
            >
              {busyKey === "create-tricycle" ? "Saving..." : "Create Tricycle"}
            </button>
          </article>
        </section>
      )}

      {isSuperadminMode && (
        <section className="superadmin-table-card">
          <div className="superadmin-table-card__header">
            <div>
              <h3>Barangays</h3>
              <p>Modify the core location scope available to admins.</p>
            </div>
            <button
              type="button"
              className="superadmin-header-action"
              onClick={openBarangayCreateModal}
            >
              Add Barangay
            </button>
          </div>
          <div className="superadmin-table">
            <div className="superadmin-table__head">
              <span>Name</span>
              <span>District</span>
              <span>City</span>
              <span>Status</span>
              <span>TODAs</span>
              <span>Actions</span>
            </div>
            {data.barangays.length === 0 ? (
              <div className="superadmin-table__empty">No barangays added yet.</div>
            ) : (
              data.barangays.map((row) => {
                const rowBusy =
                  busyKey === `save-barangay-${row.barangayId}` ||
                  busyKey === `delete-barangay-${row.barangayId}`

                return (
                  <div className="superadmin-table__row" key={row.barangayId}>
                    <span className="superadmin-table__text">{row.barangayName}</span>
                    <span className="superadmin-table__text">{row.district || "—"}</span>
                    <span className="superadmin-table__text">{row.city}</span>
                    <span className={`superadmin-status superadmin-status--${row.status}`}>
                      {formatStatusLabel(row.status)}
                    </span>
                    <span className="superadmin-badge">{row.todaCount}</span>
                    <div className="superadmin-row-actions">
                      <button
                        type="button"
                        className="superadmin-row-action superadmin-row-action--secondary"
                        onClick={() => openBarangayEditModal(row)}
                        disabled={rowBusy}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="superadmin-row-action superadmin-row-action--danger"
                        onClick={() => openDeleteBarangayDialog(row)}
                        disabled={rowBusy}
                      >
                        {busyKey === `delete-barangay-${row.barangayId}` ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>
      )}

      {isSuperadminMode && (
        <section className="superadmin-table-card">
          <div className="superadmin-table-card__header">
            <div>
              <h3>TODAs</h3>
              <p>Assign TODAs to barangays and control their availability.</p>
            </div>
            <button
              type="button"
              className="superadmin-header-action"
              onClick={openTodaCreateModal}
              disabled={barangayOptions.length === 0}
            >
              Add TODA
            </button>
          </div>
          <div className="superadmin-table superadmin-table--toda">
            <div className="superadmin-table__head">
              <span>Barangay</span>
              <span>TODA</span>
              <span>Status</span>
              <span>Drivers</span>
              <span>Tricycles</span>
              <span>Actions</span>
            </div>
            {data.todas.length === 0 ? (
              <div className="superadmin-table__empty">No TODAs added yet.</div>
            ) : (
              data.todas.map((row) => {
                const rowBusy =
                  busyKey === `save-toda-${row.todaId}` || busyKey === `delete-toda-${row.todaId}`

                return (
                  <div className="superadmin-table__row" key={row.todaId}>
                    <span className="superadmin-table__text">{row.barangayName}</span>
                    <span className="superadmin-table__text">{row.todaName}</span>
                    <span className={`superadmin-status superadmin-status--${row.status}`}>
                      {formatStatusLabel(row.status)}
                    </span>
                    <span className="superadmin-badge">{row.driverCount}</span>
                    <span className="superadmin-badge">{row.tricycleCount}</span>
                    <div className="superadmin-row-actions">
                      <button
                        type="button"
                        className="superadmin-row-action superadmin-row-action--secondary"
                        onClick={() => openTodaEditModal(row)}
                        disabled={rowBusy}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="superadmin-row-action superadmin-row-action--danger"
                        onClick={() => openDeleteTodaDialog(row)}
                        disabled={rowBusy}
                      >
                        {busyKey === `delete-toda-${row.todaId}` ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>
      )}

      {isTodaAdminMode && (
        <section className="superadmin-table-card">
          <div className="superadmin-table-card__header">
            <div>
              <h3>Drivers</h3>
              <p>Maintain the driver records available to your TODA mobile units.</p>
            </div>
          </div>
          <div className="superadmin-table superadmin-table--driver">
            <div className="superadmin-table__head">
              <span>Tricycle</span>
              <span>QR ID</span>
              <span>First name</span>
              <span>Last name</span>
              <span>Contact</span>
              <span>Status</span>
              <span>Password</span>
              <span />
            </div>
            {data.drivers.map((row) => (
              <div className="superadmin-table__row" key={row.driverId}>
                <select
                  value={row.tricycleId ?? ""}
                  onChange={(event) => {
                    const tricycleId = event.target.value ? Number(event.target.value) : undefined
                    const tricycle = data.tricycles.find((item) => item.tricycleId === tricycleId)
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
                <input
                  value={row.qrId ?? ""}
                  onChange={(event) =>
                    updateDriverDraft(row.driverId, {
                      qrId: event.target.value ? Number(event.target.value) : undefined
                    })
                  }
                />
                <input
                  value={row.firstName}
                  onChange={(event) =>
                    updateDriverDraft(row.driverId, { firstName: event.target.value })
                  }
                />
                <input
                  value={row.lastName}
                  onChange={(event) =>
                    updateDriverDraft(row.driverId, { lastName: event.target.value })
                  }
                />
                <input
                  value={row.contactNo ?? ""}
                  onChange={(event) =>
                    updateDriverDraft(row.driverId, { contactNo: event.target.value })
                  }
                />
                <select
                  value={row.status}
                  onChange={(event) =>
                    updateDriverDraft(row.driverId, { status: event.target.value as EntityStatus })
                  }
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <span className="superadmin-badge">{row.passwordSet ? "Set" : "Pending"}</span>
                <button
                  type="button"
                  onClick={() => void saveDriver(row)}
                  disabled={busyKey === `driver-${row.driverId}`}
                >
                  {busyKey === `driver-${row.driverId}` ? "Saving..." : "Save"}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {isTodaAdminMode && (
        <section className="superadmin-table-card">
          <div className="superadmin-table-card__header">
            <div>
              <h3>Tricycles</h3>
              <p>Manage the units assigned to your TODA.</p>
            </div>
          </div>
          <div className="superadmin-table superadmin-table--tricycle">
            <div className="superadmin-table__head">
              <span>Plate no</span>
              <span>Reg no</span>
              <span>Permit exp.</span>
              <span>Status</span>
              <span />
            </div>
            {data.tricycles.map((row) => (
              <div className="superadmin-table__row" key={row.tricycleId}>
                <input
                  value={row.plateNo}
                  onChange={(event) =>
                    updateTricycleDraft(row.tricycleId, { plateNo: event.target.value })
                  }
                />
                <input
                  value={row.regNo ?? ""}
                  onChange={(event) =>
                    updateTricycleDraft(row.tricycleId, { regNo: event.target.value })
                  }
                />
                <input
                  type="date"
                  value={toDateInputValue(row.permitExpirationDate)}
                  onChange={(event) =>
                    updateTricycleDraft(row.tricycleId, {
                      permitExpirationDate: event.target.value
                    })
                  }
                />
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
                      {status}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void saveTricycle(row)}
                  disabled={busyKey === `tricycle-${row.tricycleId}`}
                >
                  {busyKey === `tricycle-${row.tricycleId}` ? "Saving..." : "Save"}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {isSuperadminMode && (
        <section className="superadmin-table-card">
          <div className="superadmin-table-card__header">
            <div>
              <h3>Routes</h3>
              <p>Keep route definitions current before you connect the mobile app.</p>
            </div>
            <button
              type="button"
              className="superadmin-header-action"
              onClick={openRouteCreateModal}
              disabled={todaOptions.length === 0}
            >
              Add Route
            </button>
          </div>
          <div className="superadmin-table superadmin-table--route">
            <div className="superadmin-table__head">
              <span>TODA</span>
              <span>Origin</span>
              <span>Destination</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {data.routes.length === 0 ? (
              <div className="superadmin-table__empty">No routes added yet.</div>
            ) : (
              data.routes.map((row) => {
                const rowBusy =
                  busyKey === `save-route-${row.routeId}` || busyKey === `delete-route-${row.routeId}`

                return (
                  <div className="superadmin-table__row" key={row.routeId}>
                    <span className="superadmin-table__text">
                      {row.barangayName} - {row.todaName}
                    </span>
                    <span className="superadmin-table__text">{row.origin}</span>
                    <span className="superadmin-table__text">{row.destination}</span>
                    <span className={`superadmin-status superadmin-status--${row.status}`}>
                      {formatStatusLabel(row.status)}
                    </span>
                    <div className="superadmin-row-actions">
                      <button
                        type="button"
                        className="superadmin-row-action superadmin-row-action--secondary"
                        onClick={() => openRouteEditModal(row)}
                        disabled={rowBusy}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="superadmin-row-action superadmin-row-action--danger"
                        onClick={() => openDeleteRouteDialog(row)}
                        disabled={rowBusy}
                      >
                        {busyKey === `delete-route-${row.routeId}` ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>
      )}

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
                            {status}
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
                            {status}
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
                            {status}
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
                className="superadmin-row-action superadmin-row-action--secondary"
                onClick={closeModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="superadmin-row-action"
                onClick={() => void submitSuperadminModal()}
                disabled={busyKey === modalBusyKey || modalSubmitDisabled}
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
        busy={pendingDelete !== null && busyKey === `delete-${pendingDelete.entity}-${pendingDelete.id}`}
        onClose={closeDeleteDialog}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  )
}
