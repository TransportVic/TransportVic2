import path from 'path'
import url from 'url'
import fs from 'fs/promises'
import { StopsLoader } from '@transportme/load-ptv-gtfs'
import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'

import uniqueStops from '../../transportvic-data/excel/stops/unique-stops.json' with { type: 'json' }
import nameOverrides from '../../transportvic-data/excel/stops/name-overrides.json' with { type: 'json' }
import { createStopProcessor } from '../../transportvic-data/gtfs/process.mjs'
import ptvStops from '../ptv-stops.json' with { type: 'json' }
import turf from '@turf/turf'

import suburbsList from '../../transportvic-data/gtfs/stop-suburbs.json' with { type: 'json' }

const { GTFS_MODES } = GTFS_CONSTANTS

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const suburbsVIC = JSON.parse(await fs.readFile(path.join(__dirname, '../../transportvic-data/geospatial/suburb-boundaries/vic.geojson')))
const suburbsNSW = JSON.parse(await fs.readFile(path.join(__dirname, '../../transportvic-data/geospatial/suburb-boundaries/nsw.geojson')))
const suburbsACT = JSON.parse(await fs.readFile(path.join(__dirname, '../../transportvic-data/geospatial/suburb-boundaries/act.geojson')))
const suburbsSA = JSON.parse(await fs.readFile(path.join(__dirname, '../../transportvic-data/geospatial/suburb-boundaries/sa.geojson')))

const suburbs = {
   type: 'FeatureCollection',
   features: [ ...suburbsVIC.features, ...suburbsNSW.features, ...suburbsACT.features, ...suburbsSA.features ]
}

const gtfsPath = path.join(__dirname, '..', '..', 'gtfs', '{0}')

const stopsFile = path.join(gtfsPath, 'stops.txt')

export default async function loadStops(database, modes) {
  const start = new Date()
  const nameOverridesCounter = Object.keys(nameOverrides).reduce((acc, e) => {
    acc[e] = 0
    return acc
  }, {})

  const uniqueNamesCounter = uniqueStops.reduce((acc, e) => {
    acc[e] = 0
    return acc
  }, {})

  const stopProcessors = await createStopProcessor(database)

  for (const modeID of modes) {
    const mode = GTFS_MODES[modeID]

    try {
      const suburbFile = ['2', '3', '4'].includes(modeID) ? suburbsVIC : suburbs

      const stopProcessor = stopProcessors[modeID]
      const stopLoader = new StopsLoader(stopsFile.replace('{0}', modeID), suburbFile, mode, database, stop => {
        const ptvStop = ptvStops[stop.originalName]
        if (ptvStop && ptvStop.length === 1) {
          if (ptvStop[0].suburb.includes('(')) return ptvStop[0].suburb
        } else if (ptvStop) {
          const distances = ptvStop.map(ptvStop => ({
            ...ptvStop,
            distance: turf.distance(ptvStop.location, stop.location) * 1000
          }))
          const best = distances.sort((a, b) => a.distance - b.distance)[0]
          if (best.distance < 2) {
            return best.suburb
          }
        }

        return suburbsList[stop.stopGTFSID]
      })

      await stopLoader.loadStops({
        getMergeName: stop => {
          if (uniqueStops.includes(stop.fullStopName)) {
            uniqueNamesCounter[stop.fullStopName]++
            return stop.fullStopName
          }
        },
        processStop: stop => {
          const updatedName = nameOverrides[stop.fullStopName]
          if (updatedName) {
            nameOverridesCounter[stop.fullStopName]++
            stop.fullStopName = updatedName
          }

          return stopProcessor ? stopProcessor(stop) : stop
        }
      })

      console.log('Loaded stops for', mode)
    } catch (e) {
      console.log('ERROR: Failed to load stops for', GTFS_MODES[modeID])
      console.log(e)
    }
  }

  return { nameOverridesCounter, uniqueNamesCounter, time: (new Date() - start) / 1000 }
}