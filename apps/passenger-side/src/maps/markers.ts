const createMarkerShell = (className: string) => {
  const marker = document.createElement("div")
  marker.className = className
  return marker
}

export const createCurrentLocationMarker = () =>
  createMarkerShell("triketrack-map__current-marker")

export const createDestinationMarker = () =>
  createMarkerShell("triketrack-map__destination-marker")
