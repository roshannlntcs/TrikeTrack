import { useEffect, useMemo, useState } from "react"
import {
  createMasterDataItem,
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
import "./SuperadminPage.css"

type SuperadminPageProps = {
  accessToken: string
  mode?: "superadmin" | "toda-admin"
  lockedTodaId?: number
  lockedTodaLabel?: string
  onDataChanged?: () => void
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

  const [barangayForm, setBarangayForm] = useState({
    barangayName: "",
    district: "",
    city: "Davao City"
  })
  const [todaForm, setTodaForm] = useState({
    barangayId: "",
    todaName: ""
  })
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
  const [routeForm, setRouteForm] = useState({
    todaId: "",
    origin: "",
    destination: "",
    geofenceGeojsonText: ""
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

  const handleCreateBarangay = async () => {
    await withBusyState("create-barangay", async () => {
      const item = await createMasterDataItem<BarangayRecord>(accessToken, "barangay", {
        barangayName: barangayForm.barangayName,
        district: barangayForm.district || undefined,
        city: barangayForm.city
      })

      setData((current) => ({
        ...current,
        barangays: [...current.barangays, item].sort((a, b) =>
          a.barangayName.localeCompare(b.barangayName)
        )
      }))
      setBarangayForm({ barangayName: "", district: "", city: barangayForm.city })
      setNotice(`Added barangay ${item.barangayName}.`)
      onDataChanged?.()
    })
  }

  const handleCreateToda = async () => {
    await withBusyState("create-toda", async () => {
      const item = await createMasterDataItem<TodaRecord>(accessToken, "toda", {
        barangayId: Number(todaForm.barangayId),
        todaName: todaForm.todaName
      })

      await loadMasterData()
      setTodaForm({ barangayId: todaForm.barangayId, todaName: "" })
      setNotice(`Added TODA ${item.todaName}.`)
      onDataChanged?.()
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

  const handleCreateRoute = async () => {
    await withBusyState("create-route", async () => {
      const geofenceGeojson = routeForm.geofenceGeojsonText.trim()
        ? JSON.parse(routeForm.geofenceGeojsonText)
        : undefined

      const item = await createMasterDataItem<RouteRecord>(accessToken, "route", {
        todaId: Number(routeForm.todaId),
        origin: routeForm.origin,
        destination: routeForm.destination,
        geofenceGeojson
      })

      await loadMasterData()
      setRouteForm({
        todaId: routeForm.todaId,
        origin: "",
        destination: "",
        geofenceGeojsonText: ""
      })
      setNotice(`Added route ${item.origin} -> ${item.destination}.`)
      onDataChanged?.()
    })
  }

  const updateBarangayDraft = (barangayId: number, patch: Partial<BarangayRecord>) => {
    resetNotice()
    setData((current) => ({
      ...current,
      barangays: current.barangays.map((item) =>
        item.barangayId === barangayId ? { ...item, ...patch } : item
      )
    }))
  }

  const updateTodaDraft = (todaId: number, patch: Partial<TodaRecord>) => {
    resetNotice()
    setData((current) => ({
      ...current,
      todas: current.todas.map((item) => (item.todaId === todaId ? { ...item, ...patch } : item))
    }))
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

  const updateTricycleDraft = (
    tricycleId: number,
    patch: Partial<TricycleRecord>
  ) => {
    resetNotice()
    setData((current) => ({
      ...current,
      tricycles: current.tricycles.map((item) =>
        item.tricycleId === tricycleId ? { ...item, ...patch } : item
      )
    }))
  }

  const updateRouteDraft = (routeId: number, patch: Partial<RouteRecord>) => {
    resetNotice()
    setData((current) => ({
      ...current,
      routes: current.routes.map((item) =>
        item.routeId === routeId ? { ...item, ...patch } : item
      )
    }))
  }

  const saveBarangay = async (row: BarangayRecord) => {
    await withBusyState(`barangay-${row.barangayId}`, async () => {
      await updateMasterDataItem<BarangayRecord>(accessToken, "barangay", row.barangayId, {
        barangayName: row.barangayName,
        district: row.district || undefined,
        city: row.city,
        status: row.status
      })
      await loadMasterData()
      setNotice(`Updated barangay ${row.barangayName}.`)
      onDataChanged?.()
    })
  }

  const saveToda = async (row: TodaRecord) => {
    await withBusyState(`toda-${row.todaId}`, async () => {
      await updateMasterDataItem<TodaRecord>(accessToken, "toda", row.todaId, {
        barangayId: row.barangayId,
        todaName: row.todaName,
        status: row.status
      })
      await loadMasterData()
      setNotice(`Updated TODA ${row.todaName}.`)
      onDataChanged?.()
    })
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
      await updateMasterDataItem<TricycleRecord>(
        accessToken,
        "tricycle",
        row.tricycleId,
        {
          todaId: row.todaId,
          plateNo: row.plateNo,
          regNo: row.regNo || undefined,
          permitExpirationDate: row.permitExpirationDate || undefined,
          status: row.status
        }
      )
      await loadMasterData()
      setNotice(`Updated tricycle ${row.plateNo}.`)
      onDataChanged?.()
    })
  }

  const saveRoute = async (row: RouteRecord) => {
    await withBusyState(`route-${row.routeId}`, async () => {
      await updateMasterDataItem<RouteRecord>(accessToken, "route", row.routeId, {
        todaId: row.todaId,
        origin: row.origin,
        destination: row.destination,
        status: row.status
      })
      await loadMasterData()
      setNotice(`Updated route ${row.origin} -> ${row.destination}.`)
      onDataChanged?.()
    })
  }

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

      <section className="superadmin-create-grid">
        {isSuperadminMode && (
          <article className="superadmin-card">
          <h3>Add Barangay</h3>
          <input
            value={barangayForm.barangayName}
            onChange={(event) =>
              setBarangayForm((current) => ({ ...current, barangayName: event.target.value }))
            }
            placeholder="Barangay name"
          />
          <input
            value={barangayForm.district}
            onChange={(event) =>
              setBarangayForm((current) => ({ ...current, district: event.target.value }))
            }
            placeholder="District"
          />
          <input
            value={barangayForm.city}
            onChange={(event) =>
              setBarangayForm((current) => ({ ...current, city: event.target.value }))
            }
            placeholder="City"
          />
          <button
            type="button"
            onClick={() => void handleCreateBarangay()}
            disabled={busyKey === "create-barangay" || !barangayForm.barangayName || !barangayForm.city}
          >
            {busyKey === "create-barangay" ? "Saving..." : "Create Barangay"}
          </button>
          </article>
        )}

        {isSuperadminMode && (
          <article className="superadmin-card">
          <h3>Add TODA</h3>
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
          <input
            value={todaForm.todaName}
            onChange={(event) =>
              setTodaForm((current) => ({ ...current, todaName: event.target.value }))
            }
            placeholder="TODA name"
          />
          <button
            type="button"
            onClick={() => void handleCreateToda()}
            disabled={busyKey === "create-toda" || !todaForm.barangayId || !todaForm.todaName}
          >
            {busyKey === "create-toda" ? "Saving..." : "Create TODA"}
          </button>
          </article>
        )}

        {isTodaAdminMode && (
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
        )}

        {isTodaAdminMode && (
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
        )}

        {isSuperadminMode && (
          <article className="superadmin-card superadmin-card--wide">
          <h3>Add Route</h3>
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
          <input
            value={routeForm.origin}
            onChange={(event) =>
              setRouteForm((current) => ({ ...current, origin: event.target.value }))
            }
            placeholder="Origin"
          />
          <input
            value={routeForm.destination}
            onChange={(event) =>
              setRouteForm((current) => ({ ...current, destination: event.target.value }))
            }
            placeholder="Destination"
          />
          <textarea
            value={routeForm.geofenceGeojsonText}
            onChange={(event) =>
              setRouteForm((current) => ({
                ...current,
                geofenceGeojsonText: event.target.value
              }))
            }
            placeholder="Optional geofence GeoJSON"
            rows={5}
          />
          <button
            type="button"
            onClick={() => void handleCreateRoute()}
            disabled={
              busyKey === "create-route" ||
              !routeForm.todaId ||
              !routeForm.origin ||
              !routeForm.destination
            }
          >
            {busyKey === "create-route" ? "Saving..." : "Create Route"}
          </button>
          </article>
        )}
      </section>

      {isSuperadminMode && (
        <section className="superadmin-table-card">
        <div className="superadmin-table-card__header">
          <h3>Barangays</h3>
          <p>Modify the core location scope available to admins.</p>
        </div>
        <div className="superadmin-table">
          <div className="superadmin-table__head">
            <span>Name</span>
            <span>District</span>
            <span>City</span>
            <span>Status</span>
            <span>TODAs</span>
            <span />
          </div>
          {data.barangays.map((row) => (
            <div className="superadmin-table__row" key={row.barangayId}>
              <input
                value={row.barangayName}
                onChange={(event) =>
                  updateBarangayDraft(row.barangayId, { barangayName: event.target.value })
                }
              />
              <input
                value={row.district ?? ""}
                onChange={(event) =>
                  updateBarangayDraft(row.barangayId, { district: event.target.value })
                }
              />
              <input
                value={row.city}
                onChange={(event) =>
                  updateBarangayDraft(row.barangayId, { city: event.target.value })
                }
              />
              <select
                value={row.status}
                onChange={(event) =>
                  updateBarangayDraft(row.barangayId, {
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
              <span className="superadmin-badge">{row.todaCount}</span>
              <button
                type="button"
                onClick={() => void saveBarangay(row)}
                disabled={busyKey === `barangay-${row.barangayId}`}
              >
                {busyKey === `barangay-${row.barangayId}` ? "Saving..." : "Save"}
              </button>
            </div>
          ))}
        </div>
        </section>
      )}

      {isSuperadminMode && (
        <section className="superadmin-table-card">
        <div className="superadmin-table-card__header">
          <h3>TODAs</h3>
          <p>Assign TODAs to barangays and control their availability.</p>
        </div>
        <div className="superadmin-table superadmin-table--toda">
          <div className="superadmin-table__head">
            <span>Barangay</span>
            <span>TODA</span>
            <span>Status</span>
            <span>Drivers</span>
            <span>Tricycles</span>
            <span />
          </div>
          {data.todas.map((row) => (
            <div className="superadmin-table__row" key={row.todaId}>
              <select
                value={row.barangayId}
                onChange={(event) => {
                  const barangayId = Number(event.target.value)
                  const barangay = data.barangays.find((item) => item.barangayId === barangayId)
                  updateTodaDraft(row.todaId, {
                    barangayId,
                    barangayName: barangay?.barangayName ?? row.barangayName
                  })
                }}
              >
                {barangayOptions.map((barangay) => (
                  <option key={barangay.barangayId} value={barangay.barangayId}>
                    {barangay.barangayName}
                  </option>
                ))}
              </select>
              <input
                value={row.todaName}
                onChange={(event) =>
                  updateTodaDraft(row.todaId, { todaName: event.target.value })
                }
              />
              <select
                value={row.status}
                onChange={(event) =>
                  updateTodaDraft(row.todaId, { status: event.target.value as EntityStatus })
                }
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <span className="superadmin-badge">{row.driverCount}</span>
              <span className="superadmin-badge">{row.tricycleCount}</span>
              <button
                type="button"
                onClick={() => void saveToda(row)}
                disabled={busyKey === `toda-${row.todaId}`}
              >
                {busyKey === `toda-${row.todaId}` ? "Saving..." : "Save"}
              </button>
            </div>
          ))}
        </div>
        </section>
      )}

      {isTodaAdminMode && (
        <section className="superadmin-table-card">
        <div className="superadmin-table-card__header">
          <h3>Drivers</h3>
          <p>Maintain the driver records available to your TODA mobile units.</p>
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
              <span className="superadmin-badge">
                {row.passwordSet ? "Set" : "Pending"}
              </span>
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
          <h3>Tricycles</h3>
          <p>Manage the units assigned to your TODA.</p>
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
          <h3>Routes</h3>
          <p>Keep route definitions current before you connect the mobile app.</p>
        </div>
        <div className="superadmin-table superadmin-table--route">
          <div className="superadmin-table__head">
            <span>TODA</span>
            <span>Origin</span>
            <span>Destination</span>
            <span>Status</span>
            <span />
          </div>
          {data.routes.map((row) => (
            <div className="superadmin-table__row" key={row.routeId}>
              <select
                value={row.todaId}
                onChange={(event) => {
                  const todaId = Number(event.target.value)
                  const toda = data.todas.find((item) => item.todaId === todaId)
                  updateRouteDraft(row.routeId, {
                    todaId,
                    todaName: toda?.todaName ?? row.todaName,
                    barangayName: toda?.barangayName ?? row.barangayName
                  })
                }}
              >
                {todaOptions.map((toda) => (
                  <option key={toda.todaId} value={toda.todaId}>
                    {toda.barangayName} - {toda.todaName}
                  </option>
                ))}
              </select>
              <input
                value={row.origin}
                onChange={(event) =>
                  updateRouteDraft(row.routeId, { origin: event.target.value })
                }
              />
              <input
                value={row.destination}
                onChange={(event) =>
                  updateRouteDraft(row.routeId, { destination: event.target.value })
                }
              />
              <select
                value={row.status}
                onChange={(event) =>
                  updateRouteDraft(row.routeId, { status: event.target.value as EntityStatus })
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
                onClick={() => void saveRoute(row)}
                disabled={busyKey === `route-${row.routeId}`}
              >
                {busyKey === `route-${row.routeId}` ? "Saving..." : "Save"}
              </button>
            </div>
          ))}
        </div>
        </section>
      )}
    </section>
  )
}
