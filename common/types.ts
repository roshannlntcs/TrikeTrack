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

export type TripPointEvent = {
  type: "trip_point"
  driverId: string
  ts: number
  lng: number
  lat: number
  speed?: number
  heading?: number
  accuracy?: number
  tripId?: string
}

export type StartTripRequest = {
  driverId: string
  routeId: number
  tricycleId?: number
  tripStartTs?: number
}

export type TripSummary = {
  tripId: number
  driverId: number
  tricycleId: number
  routeId: number
  tripStart: string
  tripEnd?: string
  durationMinutes?: number
  fareAmount?: number
  tripStatus: "scheduled" | "ongoing" | "completed" | "cancelled"
  createdAt: string
}

export type StartTripResponse = {
  ok: boolean
  data?: TripSummary
  message?: string
}

export type EndTripRequest = {
  tripEndTs?: number
  fareAmount?: number
}
