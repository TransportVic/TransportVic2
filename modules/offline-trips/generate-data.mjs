import { MongoDatabaseConnection } from '@transportme/database'
import config from '../../config.json' with { type: 'json' }
import utils from '../../utils.mjs'
import fs from 'fs/promises'
import turf from '@turf/turf'
import url from 'url'
import path from 'path'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'
import zlib from 'node:zlib'
import wrangler from 'wrangler'
import { isPrimary } from '../replication.mjs'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const outDir = path.join(__dirname, 'out')

const stopGTFSIDMapping = {}
const routeGTFSIDMapping = {}

const HEADERS = `/*
  Access-Control-Allow-Origin: *
  Content-Type: application/x-gzip`

function compressStopTimes(tripStartTime, stopTimings) {
  return stopTimings.map(stop => ({
    stopID: stopGTFSIDMapping[stop.stopGTFSID],
    dep: stop.departureTimeMinutes - tripStartTime,
    ...(stop.platform ? { platform: stop.platform } : {})
  }))
}

function hashStopTimes(stopTimings) {
  const tripString = stopTimings.map(stop => {
    return `${stop.stopID}-${stop.dep}-${stop.platform || '-'}`
  }).join(';')
  return tripString
}

async function generateStops(db) {
  const stops = await db.getCollection('stops')
  const allStops = []

  let maxStopID = 1
  await stops.batchQuery({}, 1000, async stops => {
    allStops.push(...stops.map(stop => {
      const stopID = maxStopID++

      stop.bays.forEach(bay => stopGTFSIDMapping[bay.stopGTFSID] = stopID)

      return {
        stopID,
        name: stop.stopName,
        suburb: stop.suburb[0],
        location: turf.centerMean(stop.location).geometry.coordinates.map(c => parseFloat(c.toFixed(4)))
      }
    }))
  })

  return allStops
}

async function generateRoutes(db) {
  const routes = await db.getCollection('routes')
  const allRoutes = []

  let maxRouteID = 1
  await routes.batchQuery({}, 1000, async routes => {
    allRoutes.push(...routes.map(route => {
      const routeID = maxRouteID++

      routeGTFSIDMapping[route.routeGTFSID] = routeID
      
      return {
        routeID,
        routeGTFSID: route.routeGTFSID,
        name: route.routeName,
        number: route.routeNumber
      }
    }))
  })

  return allRoutes
}

async function generateTrips(db) {
  const gtfsTimetables = await db.getCollection('gtfs timetables')
  const allOperationDays = await gtfsTimetables.distinct('operationDays')
  const dbStartDate = utils.parseDate(allOperationDays[0])
  const dateLookup = allOperationDays.reduce((acc, date) => {
    acc[date] = utils.parseDate(date).diff(dbStartDate, 'days')
    return acc
  }, {})
  const allTrips = Object.values(GTFS_CONSTANTS.TRANSIT_MODES).reduce((acc, name) => ({ ...acc, [name]: [] }), {})
  const tripHashes = {}

  let maxTripID = 1
  await gtfsTimetables.batchQuery({}, 500, async trips => {
    trips.filter(trip => !trip.isMTMRailTrip).map(trip => {
      const tripID = maxTripID++
      const tripStartTime = trip.stopTimings[0].departureTimeMinutes

      const stopTimings = compressStopTimes(tripStartTime, trip.stopTimings)
      const tripHash = hashStopTimes(stopTimings)

      const baseTripData = {
        mode: trip.mode,
        operationDays: trip.operationDays.map(d => dateLookup[d]),
        tripID,
        routeID: routeGTFSIDMapping[trip.routeGTFSID],
        ...(trip.runID ? { runID: trip.runID } : {}),
        start: tripStartTime,
      }

      if (tripHashes[tripHash]) {
        return {
          ...baseTripData,
          refTrip: tripHashes[tripHash]
        }
      }

      tripHashes[tripHash] = tripID

      return {
        ...baseTripData,
        stopTimings
      } 
    }).forEach(trip => {
      allTrips[trip.mode].push(trip)
    })
  })

  return Object.keys(allTrips).map(mode => ({
    mode,
    startDate: allOperationDays[0],
    trips: allTrips[mode]
  }))
}

async function writeGzipped(data, name) {
  return new Promise(async resolve => {
    zlib.gzip(JSON.stringify(data), {

    }, async (err, zipped) => {
      await fs.writeFile(path.join(outDir, name + '.json'), zipped)
      resolve()
    })
  })
}

export async function generateTimetableExtract() {
  try { await fs.rm(outDir, { recursive: true }) } catch (e) {}
  try { await fs.mkdir(outDir) } catch (e) {}

  const mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
  await mongoDB.connect()

  await writeGzipped(await generateStops(mongoDB), 'stops')
  await writeGzipped(await generateRoutes(mongoDB), 'routes')

  const tripModeData = await generateTrips(mongoDB)
  for (const modeData of tripModeData) {
    await writeGzipped(modeData, `trips-${modeData.mode.replace(' ', '-')}`)
  }

  await writeGzipped({
    created: new Date().toISOString()
  }, 'info')
  await fs.writeFile(path.join(outDir, '_headers'), HEADERS)

  process.env['CLOUDFLARE_API_TOKEN'] = config.tripDataKeys.apiToken
  await wrangler.unstable_pages.deploy({
    directory: outDir,
    accountId: config.tripDataKeys.accountID,
    projectName: 'transportvic-trips',
    branch: 'main'
  })

  await mongoDB.close()
}

if (await fs.realpath(process.argv[1]) === url.fileURLToPath(import.meta.url) && await isPrimary()) {
  await generateTimetableExtract()
  process.exit(0)
}