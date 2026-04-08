export type DriverLocationEvent = {
  type: "driver_location"
  driverId: string
  ts: number
  lng: number
  lat: number
  speed?: number
  heading?: number
  accuracy?: number
  tripId?: string
}

export type ViolationReason = "OUTSIDE_ROUTE_CORRIDOR"

export type ViolationEvent = {
  type: "violation"
  driverId: string
  ts: number
  lng: number
  lat: number
  reason: ViolationReason
  routeId: string
  speed?: number
  heading?: number
  accuracy?: number
}
