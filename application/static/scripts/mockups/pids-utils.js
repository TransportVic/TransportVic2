/*

FSS Escalator {
  MAX_COLUMNS: 2,
  MIN_COLUMN_SIZE: 5,
  MAX_COLUMN_SIZE: 22
}

FSS Platform {
  MAX_COLUMNS: 4,
  CONNECTION_LOSS: 2,
  MIN_COLUMN_SIZE: 5,
  MAX_COLUMN_SIZE: 11
}

Suburban Platform {
  MAX_COLUMNS: 3,
  CONNECTION_LOSS: 2,
  MIN_COLUMN_SIZE: 5,
  MAX_COLUMN_SIZE: 10
}

*/

function calculateLineNumber(stationsCount, hasConnections, options) {
  let MAX_COLUMNS = options.MAX_COLUMNS
  let CONNECTION_LOSS = options.CONNECTION_LOSS
  let MIN_COLUMN_SIZE = options.MIN_COLUMN_SIZE
  let MAX_COLUMN_SIZE = options.MAX_COLUMN_SIZE

  // total stations with extras due to spillover from space lost due to connection message - 2 per row * last 3 rows = 6
  let totalStations = stationsCount + (hasConnections ? (MAX_COLUMNS - 1) * CONNECTION_LOSS : 0)

  for (let columnSize = MIN_COLUMN_SIZE; columnSize <= MAX_COLUMN_SIZE; columnSize++) {
    if (MAX_COLUMNS * columnSize >= totalStations) {
      return Math.floor((columnSize + MAX_COLUMN_SIZE) / 2)
    }
  }
}
