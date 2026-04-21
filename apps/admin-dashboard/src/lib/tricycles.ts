type AssignedTricycle = {
  tricycleId?: number
  tricycleNo?: string
}

export const formatTricycleUnitId = (tricycleId: number) =>
  `T-${String(tricycleId).padStart(3, "0")}`

export const formatAssignedTricycle = ({ tricycleId, tricycleNo }: AssignedTricycle) => {
  if (typeof tricycleId === "number" && tricycleId > 0) {
    return formatTricycleUnitId(tricycleId)
  }

  return tricycleNo ?? "Unassigned"
}
