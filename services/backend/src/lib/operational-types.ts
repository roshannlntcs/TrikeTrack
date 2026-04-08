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
