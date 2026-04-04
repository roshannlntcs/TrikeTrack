import { useEffect, useMemo, useState } from "react"
import {
  fetchDashboardData,
  type DashboardTripRecord
} from "../lib/dashboard-data"
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
import DeleteConfirmDialog from "../components/DeleteConfirmDialog"
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

type PendingDeleteState =
  | {
      entity: "driver"
      id: number
      title: string
      description: string
      confirmLabel: string
    }
  | {
      entity: "tricycle"
      id: number
      title: string
      description: string
      confirmLabel: string
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

const formatDateTime = (value?: string) => (value ? new Date(value).toLocaleString() : "Not set")

const formatCurrency = (value?: number) =>
  value !== undefined ? `PHP ${value.toFixed(2)}` : "Not set"

const formatTripStatusLabel = (value: DashboardTripRecord["tripStatus"]) => toTitleCase(value)

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
  const [driverTrips, setDriverTrips] = useState<DashboardTripRecord[]>([])
  const [tripHistoryLoading, setTripHistoryLoading] = useState(true)
  const [tripHistoryError, setTripHistoryError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | EntityStatus>("all")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [selectedDriver, setSelectedDriver] = useState<DriverRecord | null>(null)
  const [selectedDriverDetails, setSelectedDriverDetails] = useState<DriverRecord | null>(null)
  const [selectedTricycle, setSelectedTricycle] = useState<TricycleRecord | null>(null)
  const [driverForm, setDriverForm] = useState<DriverFormState>(createInitialDriverForm)
  const [tricycleForm, setTricycleForm] = useState<TricycleFormState>(createInitialTricycleForm)
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteState | null>(null)

  const loadMasterData = async () => {
    setLoading(true)
    setTripHistoryLoading(true)
    try {
      const [masterSnapshot, dashboardSnapshot] = await Promise.allSettled([
        fetchMasterData(accessToken),
        fetchDashboardData(accessToken)
      ])

      if (masterSnapshot.status === "rejected") {
        throw masterSnapshot.reason
      }

      const snapshot = masterSnapshot.value
      setData(snapshot)
      setError(null)

      if (dashboardSnapshot.status === "fulfilled") {
        setDriverTrips(dashboardSnapshot.value.recentTrips)
        setTripHistoryError(null)
      } else {
        setDriverTrips([])
        setTripHistoryError(String(dashboardSnapshot.reason))
      }
    } catch (loadError) {
      setError(String(loadError))
    } finally {
      setLoading(false)
      setTripHistoryLoading(false)
    }
  }

  useEffect(() => {
    void loadMasterData()
  }, [accessToken])

  useEffect(() => {
    if (!isModalOpen && !selectedDriverDetails) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      if (selectedDriverDetails) {
        setSelectedDriverDetails(null)
        return
      }
      closeModal()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isModalOpen, selectedDriverDetails])

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

  const selectedDriverTripHistory = useMemo(() => {
    if (!selectedDriverDetails) return []

    return driverTrips
      .filter(
        (trip) =>
          trip.driverId === selectedDriverDetails.driverId &&
          trip.tripStatus === "completed" &&
          Boolean(trip.tripEnd)
      )
      .sort((a, b) => new Date(b.tripStart).getTime() - new Date(a.tripStart).getTime())
  }, [driverTrips, selectedDriverDetails])

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

  const closeDeleteDialog = () => {
    setPendingDelete(null)
  }

  const closeDriverDetailsModal = () => {
    setSelectedDriverDetails(null)
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

  const openDriverDetailsModal = (row: DriverRecord) => {
    setSelectedDriverDetails(row)
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

  const openDeleteDriverDialog = (row: DriverRecord) => {
    setPendingDelete({
      entity: "driver",
      id: row.driverId,
      title: `Delete driver ${row.firstName} ${row.lastName}?`,
      description: "The driver record will be permanently removed from this TODA page.",
      confirmLabel: "Delete Driver"
    })
  }

  const openDeleteTricycleDialog = (row: TricycleRecord) => {
    setPendingDelete({
      entity: "tricycle",
      id: row.tricycleId,
      title: `Delete tricycle ${row.plateNo}?`,
      description: "The tricycle record will be permanently removed from this TODA page.",
      confirmLabel: "Delete Tricycle"
    })
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return

    const deleteKey = `delete-${pendingDelete.entity}-${pendingDelete.id}`
    setBusyKey(deleteKey)
    setError(null)
    setNotice(null)

    try {
      await deleteMasterDataItem(accessToken, pendingDelete.entity, pendingDelete.id)
      await loadMasterData()
      setNotice(
        pendingDelete.entity === "driver" ? "Deleted driver." : "Deleted tricycle."
      )
      closeDeleteDialog()
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
                    <tr
                      key={row.driverId}
                      className="fleet-table__row fleet-table__row--interactive"
                      onClick={() => openDriverDetailsModal(row)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          openDriverDetailsModal(row)
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`View details for ${row.firstName} ${row.lastName}`}
                    >
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
                            onClick={(event) => {
                              event.stopPropagation()
                              openDriverEditModal(row)
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="fleet-action fleet-action--delete"
                            onClick={(event) => {
                              event.stopPropagation()
                              openDeleteDriverDialog(row)
                            }}
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
                          onClick={() => openDeleteTricycleDialog(row)}
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

      {selectedDriverDetails && (
        <div className="fleet-modal-backdrop" role="presentation" onClick={closeDriverDetailsModal}>
          <div
            className="fleet-modal fleet-modal--details"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fleet-driver-details-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="fleet-modal__header">
              <div>
                <h3 id="fleet-driver-details-title">
                  {selectedDriverDetails.firstName} {selectedDriverDetails.lastName}
                </h3>
                <p>{selectedDriverDetails.driverCode} • {selectedDriverDetails.todaName}</p>
              </div>
              <button type="button" className="fleet-modal__close" onClick={closeDriverDetailsModal}>
                Close
              </button>
            </div>

            <div className="fleet-details">
              <section className="fleet-details__summary">
                <div>
                  <span className="fleet-details__label">Driver Status</span>
                  <span className={`fleet-status fleet-status--${selectedDriverDetails.status}`}>
                    {formatStatusLabel(selectedDriverDetails.status)}
                  </span>
                </div>
                <div>
                  <span className="fleet-details__label">Password</span>
                  <strong>{selectedDriverDetails.passwordSet ? "Set" : "Pending"}</strong>
                </div>
                <div>
                  <span className="fleet-details__label">Recent Trips</span>
                  <strong>{selectedDriverTripHistory.length}</strong>
                </div>
              </section>

              <section className="fleet-details__grid">
                <div className="fleet-details__item">
                  <span className="fleet-details__label">Contact Number</span>
                  <strong>{selectedDriverDetails.contactNo ?? "No contact provided"}</strong>
                </div>
                <div className="fleet-details__item">
                  <span className="fleet-details__label">Assigned Tricycle</span>
                  <strong>{selectedDriverDetails.tricycleNo ?? "Unassigned"}</strong>
                </div>
                <div className="fleet-details__item">
                  <span className="fleet-details__label">QR ID</span>
                  <strong>{selectedDriverDetails.qrId ? `#${selectedDriverDetails.qrId}` : "Not assigned"}</strong>
                </div>
                <div className="fleet-details__item">
                  <span className="fleet-details__label">Barangay</span>
                  <strong>{selectedDriverDetails.barangayName}</strong>
                </div>
                <div className="fleet-details__item">
                  <span className="fleet-details__label">Created</span>
                  <strong>{formatDateTime(selectedDriverDetails.createdAt)}</strong>
                </div>
              </section>

              <section className="fleet-details__section">
                <div className="fleet-details__section-header">
                  <div>
                    <h4>Trip History</h4>
                    <p>Showing the latest trips currently available in this dashboard.</p>
                  </div>
                </div>

                {tripHistoryLoading ? (
                  <div className="fleet-details__empty">Loading recent trip history...</div>
                ) : tripHistoryError ? (
                  <div className="fleet-details__empty fleet-details__empty--error">
                    Trip history is unavailable right now.
                  </div>
                ) : selectedDriverTripHistory.length === 0 ? (
                  <div className="fleet-details__empty">No recent trip history for this driver yet.</div>
                ) : (
                  <div className="fleet-trip-history">
                    {selectedDriverTripHistory.map((trip) => (
                      <article key={trip.tripId} className="fleet-trip-card">
                        <div className="fleet-trip-card__top">
                          <div>
                            <strong>{trip.routeName}</strong>
                            <div className="fleet-trip-card__meta">
                              Trip #{trip.tripId} • {trip.plateNo} • {trip.todaName}
                            </div>
                          </div>
                          <span className={`fleet-trip-status fleet-trip-status--${trip.tripStatus}`}>
                            {formatTripStatusLabel(trip.tripStatus)}
                          </span>
                        </div>

                        <div className="fleet-trip-card__stats">
                          <div>
                            <span>Start</span>
                            <strong>{formatDateTime(trip.tripStart)}</strong>
                          </div>
                          <div>
                            <span>End</span>
                            <strong>{formatDateTime(trip.tripEnd)}</strong>
                          </div>
                          <div>
                            <span>Duration</span>
                            <strong>
                              {trip.durationMinutes !== undefined ? `${trip.durationMinutes} min` : "Not set"}
                            </strong>
                          </div>
                          <div>
                            <span>Fare</span>
                            <strong>{formatCurrency(trip.fareAmount)}</strong>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}

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
