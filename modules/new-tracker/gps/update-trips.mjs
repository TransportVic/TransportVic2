export async function updateTrips(getPositions = () => [], keepOperators = () => []) {
}

export async function getRelevantTrips(getPositions = () => [], keepOperators = () => []) {
  const positions = await getPositions()
  const operators = keepOperators()
  return positions.filter(pos => operators.includes(pos.operator))
}

export async function getTripData(position, db) {
  
}