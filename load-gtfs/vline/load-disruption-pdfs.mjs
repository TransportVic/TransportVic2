import path from 'path'
import scripts from '../../transportvic-data/rail-pdfs/scripts.mjs'
import { spawn } from 'child_process'
import config from '../../config.json' with { type: 'json' }
import { MongoDatabaseConnection } from '@transportme/database'

const mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

const gtfsTimetables = mongoDB.getCollection('gtfs timetables')

const file = path.join(import.meta.dirname, '../..', 'scripts', 'load-vline-tt.mjs')

for (const command of scripts.commands) {
  await new Promise(resolve => {
    console.log('node', [ file, ...command ].join(' '))

    const childProcess = spawn('node', [ file, ...command ], {
      cwd: scripts.cwd
    })

    childProcess.stdout.pipe(process.stdout)
    childProcess.stderr.pipe(process.stderr)

    childProcess.on('close', code => {
      console.log('Finished with code', code)
      resolve()
    })
  })
}

for (const disruption of scripts.supercede) {
  const trips = await gtfsTimetables.findDocuments({
    mode: 'regional train',
    operationDays: {
      $in: disruption.operationDays
    },
    routeName: {
      $in: disruption.routeName
    },
    manualOccoTrip: { $exists: false }
  }).toArray()

  trips.forEach(trip => {
    trip.operationDays = trip.operationDays.filter(day => !disruption.operationDays.includes(day))
  })

  const bulkWrite = trips.map(trip => {
    if (trip.operationDays.length === 0) return {
      deleteOne: {
        filter: { _id: trip._id }
      }
    }

    return {
      updateOne: {
        filter: { _id: trip._id },
        update: {
          $set: {
            operationDays: trip.operationDays
          }
        }
      }
    }
  })

  if (bulkWrite.length) await gtfsTimetables.bulkWrite(bulkWrite)
}

process.exit(0)