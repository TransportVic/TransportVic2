/**
 * Occupancy (passenger load) data from a GTFS-R VehiclePosition.
 *
 * The GTFS-R OccupancyStatus enum is decoded to an integer by the feed reader,
 * so it is mapped here to the kebab-case tokens used elsewhere in the tracker
 * (see the notify levels and delay states). Per-carriage figures, when present,
 * are carried through in consist order via the carriage_sequence field.
 *
 * Note: the VIC OpenData feed currently populates these fields with placeholder
 * zeros (EMPTY / 0%, no carriage detail), so parseOccupancy only returns a value
 * once the feed reports an actual load. It will surface real figures unchanged
 * as soon as the upstream feed starts publishing them.
 */

export const OCCUPANCY_STATUS = {
  0: 'empty',
  1: 'many-seats-available',
  2: 'few-seats-available',
  3: 'standing-room-only',
  4: 'crushed-standing-room-only',
  5: 'full',
  6: 'not-accepting-passengers',
  7: null, // NO_DATA_AVAILABLE
  8: 'not-boardable'
}

function parseStatus(status) {
  if (typeof status !== 'number') return null
  return OCCUPANCY_STATUS[status] || null
}

function parsePercentage(percentage) {
  if (typeof percentage !== 'number' || percentage < 0) return null
  return percentage
}

function parseCarriages(carriages) {
  if (!carriages || !carriages.length) return []

  return carriages
    .map(carriage => {
      let carriageData = {
        sequence: carriage.carriage_sequence,
        status: parseStatus(carriage.occupancy_status)
      }

      let percentage = parsePercentage(carriage.occupancy_percentage)
      if (percentage !== null) carriageData.percentage = percentage
      if (carriage.label) carriageData.label = carriage.label

      return carriageData
    })
    .filter(carriage => carriage.status || typeof carriage.percentage !== 'undefined')
    .sort((a, b) => a.sequence - b.sequence)
}

/**
 * Reports whether a vehicle carries a usable occupancy signal.
 *
 * A bare EMPTY status with no percentage and no carriage detail is treated as
 * "no data", as that is indistinguishable from the feed's placeholder default.
 */
function hasOccupancySignal(status, percentage, carriages) {
  if (carriages.length) return true
  if (percentage !== null && percentage > 0) return true
  return status !== null && status !== 'empty'
}

export function parseOccupancy(vehicle, timestamp) {
  if (!vehicle) return null

  let status = parseStatus(vehicle.occupancy_status)
  let percentage = parsePercentage(vehicle.occupancy_percentage)
  let carriages = parseCarriages(vehicle.multi_carriage_details)

  if (!hasOccupancySignal(status, percentage, carriages)) return null

  let occupancy = { timestamp }
  if (status) occupancy.status = status
  if (percentage !== null) occupancy.percentage = percentage
  if (carriages.length) occupancy.carriages = carriages

  return occupancy
}
