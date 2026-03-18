import { useEffect, useMemo, useState } from "react"
import {
  createMasterDataItem,
  deleteMasterDataItem,
  fetchMasterData,
  updateMasterDataItem,
  type DriverRecord,
  type EntityStatus,
  type MasterDataSnapshot,
  type TricycleRecord
} from "../lib/superadmin-api"
import "./TodaManagementPage.css"

type TodaManagementPageProps = {
  accessToken: string
  page: "drivers" | "tricycles"
  lockedTodaId?: number
  lockedTodaLabel?: string
  onDataChanged?: () => void
}

type DriverFormState = {
  firstName: string
  lastName: string
  contactNo: string
  tricycleId: string
  qrId: string
  status: EntityStatus
}

type TricycleFormState = {
  plateNo: string
  regNo: string
  permitExpirationDate: string
  status: EntityStatus
}

const STATUS_OPTIONS: Array<"all" | EntityStatus> = [
  "all",
  "active",
  "inactive",
  "suspended"
]

const initialMasterData: MasterDataSnapshot = {
  barangays: [],
  todas: [],
  drivers: [],
  tricycles: [],
  routes: []
}

const createInitialDriverForm = (): DriverFormState => ({
  firstName: "",
  lastName: "",
  contactNo: "",
  tricycleId: "",
  qrId: "",
  status: "active"
})

const createInitialTricycleForm = (): TricycleFormState => ({
  plateNo: "",
  regNo: "",
  permitExpirationDate: "",
  status: "active"
})

const toDateInputValue = (value?: string) => (value ? value.slice(0, 10) : "")

const toTitleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

const formatStatusLabel = (value: EntityStatus) => toTitleCase(value)

const formatTricycleCode = (tricycleId: number) => `T${String(tricycleId).padStart(3, "0")}`

export default function TodaManagementPage({
  accessToken,
  page,
  lockedTodaId,
  lockedTodaLabel,
  onDataChanged
}: TodaManagementPageProps) {
  const isDriverPage = page === "drivers"
  const [data, setData] = useState<MasterDataSnapshot>(initialMasterData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | EntityStatus>("all")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [selectedDriver, setSelectedDriver] = useState<DriverRecord | null>(null)
  const [selectedTricycle, setSelectedTricycle] = useState<TricycleRecord | null>(null)
  const [driverForm, setDriverForm] = useState<DriverFormState>(createInitialDriverForm)
  const [tricycleForm, setTricycleForm] = useState<TricycleFormState>(createInitialTricycleForm)

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

  const filteredDriverRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return data.drivers.filter((row) => {
      const matchesStatus = statusFilter === "all" || row.status === statusFilter
      if (!matchesStatus) return false
      if (!normalizedQuery) return true

      return (
        row.driverCode.toLowerCase().includes(normalizedQuery) ||
        `${row.firstName} ${row.lastName}`.toLowerCase().includes(normalizedQuery) ||
        (row.tricycleNo?.toLowerCase().includes(normalizedQuery) ?? false) ||
        (row.contactNo?.toLowerCase().includes(normalizedQuery) ?? false) ||
        row.status.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [data.drivers, searchQuery, statusFilter])

  const filteredTricycleRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return data.tricycles.filter((row) => {
      const matchesStatus = statusFilter === "all" || row.status === statusFilter
      if (!matchesStatus) return false
      if (!normalizedQuery) return true

      return (
        formatTricycleCode(row.tricycleId).toLowerCase().includes(normalizedQuery) ||
        row.plateNo.toLowerCase().includes(normalizedQuery) ||
        (row.regNo?.toLowerCase().includes(normalizedQuery) ?? false) ||
        row.status.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [data.tricycles, searchQuery, statusFilter])

  const tricycleOptions = useMemo(() => data.tricycles, [data.tricycles])

  const resetFeedback = () => {
    setError(null)
    setNotice(null)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedDriver(null)
    setSelectedTricycle(null)
    setDriverForm(createInitialDriverForm())
    setTricycleForm(createInitialTricycleForm())
  }

  const openCreateModal = () => {
    resetFeedback()
    setModalMode("create")
    setSelectedDriver(null)
    setSelectedTricycle(null)
    setDriverForm(createInitialDriverForm())
    setTricycleForm(createInitialTricycleForm())
    setIsModalOpen(true)
  }

  const openDriverEditModal = (row: DriverRecord) => {
    resetFeedback()
    setModalMode("edit")
    setSelectedDriver(row)
    setDriverForm({
      firstName: row.firstName,
      lastName: row.lastName,
      contactNo: row.contactNo ?? "",
      tricycleId: row.tricycleId ? String(row.tricycleId) : "",
      qrId: row.qrId ? String(row.qrId) : "",
      status: row.status
    })
    setIsModalOpen(true)
  }

  const openTricycleEditModal = (row: TricycleRecord) => {
    resetFeedback()
    setModalMode("edit")
    setSelectedTricycle(row)
    setTricycleForm({
      plateNo: row.plateNo,
      regNo: row.regNo ?? "",
      permitExpirationDate: toDateInputValue(row.permitExpirationDate),
      status: row.status
    })
    setIsModalOpen(true)
  }

  const handleDriverSubmit = async () => {
    if (!lockedTodaId) {
      setError("This TODA admin account is missing an assigned TODA.")
      return
    }

    const busyAction = modalMode === "create" ? "create-driver" : `save-driver-${selectedDriver?.driverId}`
    setBusyKey(busyAction)
    setError(null)
    setNotice(null)

    try {
      if (modalMode === "create") {
        const created = await createMasterDataItem<DriverRecord>(accessToken, "driver", {
          todaId: lockedTodaId,
          tricycleId: driverForm.tricycleId ? Number(driverForm.tricycleId) : undefined,
          qrId: driverForm.qrId ? Number(driverForm.qrId) : undefined,
          firstName: driverForm.firstName,
          lastName: driverForm.lastName,
          contactNo: driverForm.contactNo || undefined
        })

        if (driverForm.status !== "active") {
          await updateMasterDataItem<DriverRecord>(accessToken, "driver", created.driverId, {
            status: driverForm.status
          })
        }

        setNotice(`Added driver ${driverForm.firstName} ${driverForm.lastName}.`)
      } else if (selectedDriver) {
        await updateMasterDataItem<DriverRecord>(accessToken, "driver", selectedDriver.driverId, {
          todaId: lockedTodaId,
          tricycleId: driverForm.tricycleId ? Number(driverForm.tricycleId) : null,
          qrId: driverForm.qrId ? Number(driverForm.qrId) : null,
          firstName: driverForm.firstName,
          lastName: driverForm.lastName,
          contactNo: driverForm.contactNo || null,
          status: driverForm.status
        })

        setNotice(`Updated driver ${driverForm.firstName} ${driverForm.lastName}.`)
      }

      await loadMasterData()
      onDataChanged?.()
      closeModal()
    } catch (submitError) {
      setError(String(submitError))
    } finally {
      setBusyKey(null)
    }
  }

  const handleTricycleSubmit = async () => {
    if (!lockedTodaId) {
      setError("This TODA admin account is missing an assigned TODA.")
      return
    }

    const busyAction =
      modalMode === "create" ? "create-tricycle" : `save-tricycle-${selectedTricycle?.tricycleId}`
    setBusyKey(busyAction)
    setError(null)
    setNotice(null)

    try {
      if (modalMode === "create") {
        const created = await createMasterDataItem<TricycleRecord>(accessToken, "tricycle", {
          todaId: lockedTodaId,
          plateNo: tricycleForm.plateNo,
          regNo: tricycleForm.regNo || undefined,
          permitExpirationDate: tricycleForm.permitExpirationDate || undefined
        })

        if (tricycleForm.status !== "active") {
          await updateMasterDataItem<TricycleRecord>(
            accessToken,
            "tricycle",
            created.tricycleId,
            {
              status: tricycleForm.status
            }
          )
        }

        setNotice(`Added tricycle ${tricycleForm.plateNo}.`)
      } else if (selectedTricycle) {
        await updateMasterDataItem<TricycleRecord>(
          accessToken,
          "tricycle",
          selectedTricycle.tricycleId,
          {
            todaId: lockedTodaId,
            plateNo: tricycleForm.plateNo,
            regNo: tricycleForm.regNo || null,
            permitExpirationDate: tricycleForm.permitExpirationDate || null,
            status: tricycleForm.status
          }
        )

        setNotice(`Updated tricycle ${tricycleForm.plateNo}.`)
      }

      await loadMasterData()
      onDataChanged?.()
      closeModal()
    } catch (submitError) {
      setError(String(submitError))
    } finally {
      setBusyKey(null)
    }
  }

  const handleDeleteDriver = async (row: DriverRecord) => {
    const confirmed = window.confirm(
      `Delete driver ${row.firstName} ${row.lastName}? This cannot be undone.`
    )
    if (!confirmed) return

    setBusyKey(`delete-driver-${row.driverId}`)
    setError(null)
    setNotice(null)

    try {
      await deleteMasterDataItem(accessToken, "driver", row.driverId)
      await loadMasterData()
      setNotice(`Deleted driver ${row.firstName} ${row.lastName}.`)
      onDataChanged?.()
    } catch (deleteError) {
      setError(String(deleteError))
    } finally {
      setBusyKey(null)
    }
  }

  const handleDeleteTricycle = async (row: TricycleRecord) => {
    const confirmed = window.confirm(
      `Delete tricycle ${row.plateNo}? This cannot be undone.`
    )
    if (!confirmed) return

    setBusyKey(`delete-tricycle-${row.tricycleId}`)
    setError(null)
    setNotice(null)

    try {
      await deleteMasterDataItem(accessToken, "tricycle", row.tricycleId)
      await loadMasterData()
      setNotice(`Deleted tricycle ${row.plateNo}.`)
      onDataChanged?.()
    } catch (deleteError) {
      setError(String(deleteError))
    } finally {
      setBusyKey(null)
    }
  }

  const pageTitle = isDriverPage ? "Drivers" : "Tricycles"
  const searchPlaceholder = isDriverPage ? "Search drivers..." : "Search tricycles..."
  const addButtonLabel = isDriverPage ? "Add Driver" : "Add Tricycle"
  const totalCount = isDriverPage ? data.drivers.length : data.tricycles.length
  const filteredCount = isDriverPage ? filteredDriverRows.length : filteredTricycleRows.length
  const modalBusyKey = isDriverPage
    ? modalMode === "create"
      ? "create-driver"
      : `save-driver-${selectedDriver?.driverId}`
    : modalMode === "create"
      ? "create-tricycle"
      : `save-tricycle-${selectedTricycle?.tricycleId}`

  return (
    <section className="fleet-page">
      <header className="fleet-page__header">
        <div>
          <h2>{pageTitle}</h2>
          <p>
            {lockedTodaLabel
              ? `${filteredCount} of ${totalCount} records for ${lockedTodaLabel}.`
              : `${filteredCount} of ${totalCount} records loaded.`}
          </p>
        </div>
      </header>

      {(error || notice) && (
        <div className={`fleet-banner ${error ? "fleet-banner--error" : ""}`}>
          {error ?? notice}
        </div>
      )}

      <section className="fleet-toolbar">
        <input
          className="fleet-toolbar__search"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          aria-label={searchPlaceholder}
        />

        <select
          className="fleet-toolbar__filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as "all" | EntityStatus)}
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status === "all" ? "All Status" : formatStatusLabel(status)}
            </option>
          ))}
        </select>

        <button type="button" className="fleet-toolbar__button" onClick={openCreateModal}>
          {addButtonLabel}
        </button>
      </section>

      <section className="fleet-table-card">
        <div className="fleet-table-wrap">
          {loading ? (
            <div className="fleet-empty">Loading {pageTitle.toLowerCase()}...</div>
          ) : isDriverPage ? (
            filteredDriverRows.length === 0 ? (
              <div className="fleet-empty">No drivers found for the current filters.</div>
            ) : (
              <table className="fleet-table">
                <thead>
                  <tr>
                    <th>Driver ID</th>
                    <th>Name</th>
                    <th>Tricycle</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th>Password</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDriverRows.map((row) => (
                    <tr key={row.driverId}>
                      <td>{row.driverCode}</td>
                      <td>{row.firstName} {row.lastName}</td>
                      <td>{row.tricycleNo ?? "Unassigned"}</td>
                      <td>{row.contactNo ?? "No contact"}</td>
                      <td>
                        <span className={`fleet-status fleet-status--${row.status}`}>
                          {formatStatusLabel(row.status)}
                        </span>
                      </td>
                      <td>{row.passwordSet ? "Set" : "Pending"}</td>
                      <td>
                        <div className="fleet-actions">
                          <button
                            type="button"
                            className="fleet-action fleet-action--edit"
                            onClick={() => openDriverEditModal(row)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="fleet-action fleet-action--delete"
                            onClick={() => void handleDeleteDriver(row)}
                            disabled={busyKey === `delete-driver-${row.driverId}`}
                          >
                            {busyKey === `delete-driver-${row.driverId}` ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : filteredTricycleRows.length === 0 ? (
            <div className="fleet-empty">No tricycles found for the current filters.</div>
          ) : (
            <table className="fleet-table">
              <thead>
                <tr>
                  <th>Unit ID</th>
                  <th>Plate No</th>
                  <th>Reg No</th>
                  <th>Permit Expiry</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTricycleRows.map((row) => (
                  <tr key={row.tricycleId}>
                    <td>{formatTricycleCode(row.tricycleId)}</td>
                    <td>{row.plateNo}</td>
                    <td>{row.regNo ?? "Not set"}</td>
                    <td>{toDateInputValue(row.permitExpirationDate) || "Not set"}</td>
                    <td>
                      <span className={`fleet-status fleet-status--${row.status}`}>
                        {formatStatusLabel(row.status)}
                      </span>
                    </td>
                    <td>
                      <div className="fleet-actions">
                        <button
                          type="button"
                          className="fleet-action fleet-action--edit"
                          onClick={() => openTricycleEditModal(row)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="fleet-action fleet-action--delete"
                          onClick={() => void handleDeleteTricycle(row)}
                          disabled={busyKey === `delete-tricycle-${row.tricycleId}`}
                        >
                          {busyKey === `delete-tricycle-${row.tricycleId}` ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {isModalOpen && (
        <div className="fleet-modal-backdrop" role="presentation" onClick={closeModal}>
          <div
            className="fleet-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fleet-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="fleet-modal__header">
              <div>
                <h3 id="fleet-modal-title">
                  {modalMode === "create"
                    ? isDriverPage
                      ? "Add Driver"
                      : "Add Tricycle"
                    : isDriverPage
                      ? "Edit Driver"
                      : "Edit Tricycle"}
                </h3>
                <p>{lockedTodaLabel ?? "Assigned TODA"}</p>
              </div>
              <button type="button" className="fleet-modal__close" onClick={closeModal}>
                Close
              </button>
            </div>

            {isDriverPage ? (
              <form
                className="fleet-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleDriverSubmit()
                }}
              >
                <label>
                  <span>First Name</span>
                  <input
                    value={driverForm.firstName}
                    onChange={(event) =>
                      setDriverForm((current) => ({
                        ...current,
                        firstName: event.target.value
                      }))
                    }
                    required
                  />
                </label>

                <label>
                  <span>Last Name</span>
                  <input
                    value={driverForm.lastName}
                    onChange={(event) =>
                      setDriverForm((current) => ({
                        ...current,
                        lastName: event.target.value
                      }))
                    }
                    required
                  />
                </label>

                <label>
                  <span>Assigned Tricycle</span>
                  <select
                    value={driverForm.tricycleId}
                    onChange={(event) =>
                      setDriverForm((current) => ({
                        ...current,
                        tricycleId: event.target.value
                      }))
                    }
                  >
                    <option value="">No tricycle</option>
                    {tricycleOptions.map((tricycle) => (
                      <option key={tricycle.tricycleId} value={tricycle.tricycleId}>
                        {tricycle.plateNo}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>QR ID</span>
                  <input
                    value={driverForm.qrId}
                    onChange={(event) =>
                      setDriverForm((current) => ({
                        ...current,
                        qrId: event.target.value
                      }))
                    }
                    inputMode="numeric"
                    placeholder="Optional"
                  />
                </label>

                <label>
                  <span>Contact Number</span>
                  <input
                    value={driverForm.contactNo}
                    onChange={(event) =>
                      setDriverForm((current) => ({
                        ...current,
                        contactNo: event.target.value
                      }))
                    }
                    placeholder="Optional"
                  />
                </label>

                <label>
                  <span>Status</span>
                  <select
                    value={driverForm.status}
                    onChange={(event) =>
                      setDriverForm((current) => ({
                        ...current,
                        status: event.target.value as EntityStatus
                      }))
                    }
                  >
                    {STATUS_OPTIONS.filter((status) => status !== "all").map((status) => (
                      <option key={status} value={status}>
                        {formatStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="fleet-modal__footer">
                  <button type="button" className="fleet-modal__secondary" onClick={closeModal}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="fleet-modal__primary"
                    disabled={
                      busyKey === modalBusyKey ||
                      !driverForm.firstName.trim() ||
                      !driverForm.lastName.trim()
                    }
                  >
                    {busyKey === modalBusyKey
                      ? "Saving..."
                      : modalMode === "create"
                        ? "Save Driver"
                        : "Update Driver"}
                  </button>
                </div>
              </form>
            ) : (
              <form
                className="fleet-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleTricycleSubmit()
                }}
              >
                <label>
                  <span>Plate No</span>
                  <input
                    value={tricycleForm.plateNo}
                    onChange={(event) =>
                      setTricycleForm((current) => ({
                        ...current,
                        plateNo: event.target.value
                      }))
                    }
                    required
                  />
                </label>

                <label>
                  <span>Registration No</span>
                  <input
                    value={tricycleForm.regNo}
                    onChange={(event) =>
                      setTricycleForm((current) => ({
                        ...current,
                        regNo: event.target.value
                      }))
                    }
                    placeholder="Optional"
                  />
                </label>

                <label>
                  <span>Permit Expiration</span>
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
                </label>

                <label>
                  <span>Status</span>
                  <select
                    value={tricycleForm.status}
                    onChange={(event) =>
                      setTricycleForm((current) => ({
                        ...current,
                        status: event.target.value as EntityStatus
                      }))
                    }
                  >
                    {STATUS_OPTIONS.filter((status) => status !== "all").map((status) => (
                      <option key={status} value={status}>
                        {formatStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="fleet-modal__footer">
                  <button type="button" className="fleet-modal__secondary" onClick={closeModal}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="fleet-modal__primary"
                    disabled={busyKey === modalBusyKey || !tricycleForm.plateNo.trim()}
                  >
                    {busyKey === modalBusyKey
                      ? "Saving..."
                      : modalMode === "create"
                        ? "Save Tricycle"
                        : "Update Tricycle"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
