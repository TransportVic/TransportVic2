const fs = require('fs')
const path = require('path')
const BufferedLineReader = require('./BufferedLineReader')
const gtfsUtils = require('../../gtfs-utils')
const utils = require('../../utils')
const gtfsModes = require('../gtfs-modes.json')
const datamartModes = require('../datamart-modes.json')
const updateStats = require('../utils/stats')
let gtfsID = process.argv[2]

let gtfsMode = gtfsModes[gtfsID]
let datamartMode = gtfsID === '7' ? 'telebus' : datamartModes[gtfsID]

let basePath = path.join(__dirname, '../../gtfs', gtfsID)
let splicedPath = path.join(__dirname, '../spliced-gtfs-stuff', gtfsID)

let stopsLineReader = new BufferedLineReader(path.join(basePath, 'stops.txt'))
let shapesLineReader = new BufferedLineReader(path.join(basePath, 'shapes.txt'))
let tripTimingsLineReader = new BufferedLineReader(path.join(basePath, 'stop_times.txt'))
let tripsLineReader = new BufferedLineReader(path.join(basePath, 'trips.txt'))

// STOPS
async function read5000Stops() {
  let stops = []

  for (let i = 0; i < 5000; i++) {
    if (!stopsLineReader.available()) break
    let line = await stopsLineReader.nextLine()
    line = gtfsUtils.splitLine(line)

    let stopGTFSID = parseInt(line[0])
    let originalName = line[1]

    if (stopGTFSID === 35117) {
      originalName += ' (Ballarat Central)'
    }

    let adjustedOriginalStopName = utils.adjustRawStopName(originalName)
    let suburbIndex = adjustedOriginalStopName.lastIndexOf('(')
    let adjustedStopName = adjustedOriginalStopName.slice(0, suburbIndex - 1)
    let suburb = adjustedOriginalStopName.slice(suburbIndex + 1, -1)

    let fullStopName = utils.expandStopName(utils.adjustStopName(adjustedStopName))
    let stopNumber = null
    let stopNumberParts

    if (stopNumberParts = fullStopName.match(/^(D?\d+[A-Za-z]?)-(.+)/)) {
      stopNumber = stopNumberParts[1].toUpperCase()
      fullStopName = fullStopName.replace(/^(D?\d+[A-Za-z]?)-/, '')
    }

    if (fullStopName.includes(' - Stop')) {
      stopNumber = originalName.match(/ - Stop (D?\d*[A-Za-z]?)/)[1].toUpperCase()
      fullStopName = originalName.replace(/ - Stop (D?\d*[A-Za-z]?)/, '')
    }

    let stop = {
      originalName,
      fullStopName,
      stopGTFSID,
      location: {
        type: 'Point',
        coordinates: [parseFloat(line[3]), parseFloat(line[2])]
      },
      stopNumber,
      mode: gtfsMode,
      suburb
    }
    stops.push(stop)
  }

  return stops
}

async function splitStops() {
  await stopsLineReader.open()
  await stopsLineReader.nextLine()

  let i = 0
  while (stopsLineReader.available()) {
    let stops = await read5000Stops()
    fs.writeFileSync(path.join(splicedPath, `stops.${i++}.json`), JSON.stringify(stops))
  }

  await stopsLineReader.close()
  stopsLineReader = null
}

// SHAPES
async function readRouteShapes() {
  let shapes = []
  let routesSeen = []

  let currentShapeID = null
  let currentRouteGTFSID = null
  let currentShape = []
  let currentLength = null

  let batchSize = 50
  if (['1', '5'].includes(gtfsID)) batchSize = 5

  while (shapesLineReader.available()) {
    let line = await shapesLineReader.nextLine()
    line = gtfsUtils.splitLine(line)

    let shapeID = line[0]
    let routeGTFSID = gtfsUtils.simplifyRouteGTFSID(shapeID.split('.').slice(-3)[0])

    if (currentShapeID && currentShapeID !== shapeID) {
      shapesLineReader.unreadLine()
      shapes.push({
        shapeID: currentShapeID,
        routeGTFSID: currentRouteGTFSID,
        path: currentShape,
        length: currentLength
      })
      currentShape = []
      if (routesSeen.length === batchSize) return shapes
    } else {
      let newLength = parseFloat(line[4])
      if (currentLength === newLength) continue
      currentLength = newLength

      if (!routesSeen.includes(currentRouteGTFSID)) routesSeen.push(currentRouteGTFSID)
      currentShape.push([
        parseFloat(line[2]),
        parseFloat(line[1])
      ])
    }
    currentShapeID = shapeID
    currentRouteGTFSID = routeGTFSID
  }

  shapes.push({
    shapeID: currentShapeID,
    routeGTFSID: currentRouteGTFSID,
    path: currentShape,
    length: currentLength
  })

  return shapes
}

async function splitShapes() {
  await shapesLineReader.open()
  await shapesLineReader.nextLine()

  let i = 0
  while (shapesLineReader.available()) {
    let shapes = await readRouteShapes()
    fs.writeFileSync(path.join(splicedPath, `shapes.${i++}.json`), JSON.stringify(shapes))
  }

  await shapesLineReader.close()
  shapesLineReader = null
}

// TRIP TIMES
let tripIndex = {}

async function read5000TripTimings() {
  let trips = []
  let currentTripID = null
  let currentTrip = []

  while (tripTimingsLineReader.available()) {
    let line = await tripTimingsLineReader.nextLine()
    line = gtfsUtils.splitLine(line)

    let tripID = line[0]

    if (currentTripID && currentTripID !== tripID) {
      tripTimingsLineReader.unreadLine()
      trips.push({
        tripID: currentTripID,
        stopTimings: currentTrip
      })
      currentTrip = []
      if (trips.length === 5000) return trips
    } else {
      currentTrip.push({
        stopGTFSID: parseInt(line[3]),
        arrivalTime: line[1],
        departureTime: line[2],
        stopConditions: {
          pickup: parseInt(line[6]),
          dropoff: parseInt(line[7])
        },
        stopDistance: parseFloat(line[8]),
        stopSequence: parseFloat(line[4])
      })
    }

    currentTripID = tripID
  }

  trips.push({
    tripID: currentTripID,
    stopTimings: currentTrip
  })

  return trips
}

let tripTimingFiles = 0
async function splitTripTimings() {
  await tripTimingsLineReader.open()
  await tripTimingsLineReader.nextLine()

  while (tripTimingsLineReader.available()) {
    let tripTimings = await read5000TripTimings()
    tripTimings.forEach(trip => {
      let {tripID} = trip
      tripIndex[tripID] = tripTimingFiles
    })
    fs.writeFileSync(path.join(splicedPath, `trip-times.${tripTimingFiles++}.json`), JSON.stringify(tripTimings))
  }

  await tripTimingsLineReader.close()
  tripTimingsLineReader = null
}

// TRIPS

async function splitTrips() {
  await tripsLineReader.open()
  await tripsLineReader.nextLine()
  let folderPath = fs.mkdtempSync(path.join(splicedPath, 'trip-sort-'))

  let streams = {}
  for (let n = 0; n < tripTimingFiles; n++) {
    streams[n] = fs.createWriteStream(path.join(folderPath, `${n}`))
  }

  while (tripsLineReader.available()) {
    let line = await tripsLineReader.nextLine()
    let lineData = gtfsUtils.splitLine(line)
    let tripID = lineData[2]
    let splitFile = tripIndex[tripID]

    streams[splitFile].write(line + '\n')
  }

  for (let n = 0; n < tripTimingFiles; n++) {
    await new Promise(resolve => streams[n].close(resolve))
    let sortFile = path.join(folderPath, `${n}`)

    let fileData = fs.readFileSync(sortFile).toString().split('\n')
    let trips = []

    fileData.forEach(lineData => {
      if (!lineData) return
      let line = gtfsUtils.splitLine(lineData)
      let [fullRouteGTFSID, calendarID, tripID, shapeID, headsign, gtfsDirection] = line
      let routeGTFSID = gtfsUtils.simplifyRouteGTFSID(fullRouteGTFSID)
      let actualMode = gtfsMode === 'nbus' ? 'bus' : gtfsMode

      trips.push({
        mode: actualMode,
        tripID,
        routeGTFSID,
        calendarID,
        gtfsDirection,
        shapeID,
        headsign
      })
    })
    fs.unlinkSync(sortFile)

    fs.writeFileSync(path.join(splicedPath, `trips.${n}.json`), JSON.stringify(trips))
  }

  fs.rmSync(folderPath, {
    recursive: true
  })
  tripsLineReader = null
}

async function main() {
  fs.mkdirSync(splicedPath, { recursive: true })
  await splitStops()
  console.log(`Completed splitting stops for GTFS ID ${gtfsID}: ${gtfsMode}`)
  await splitShapes()
  console.log(`Completed splitting shapes for GTFS ID ${gtfsID}: ${gtfsMode}`)
  await splitTripTimings()
  console.log(`Completed splitting trip timings for GTFS ID ${gtfsID}: ${gtfsMode}`)
  await splitTrips()
  console.log(`Completed splitting trips for GTFS ID ${gtfsID}: ${gtfsMode}`)

  updateStats('divide-' + datamartMode, gtfsID)
}

main()
