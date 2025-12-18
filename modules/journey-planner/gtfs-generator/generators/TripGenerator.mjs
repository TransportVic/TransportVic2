import utils from '../../../../utils.js'
import Generator from './Generator.mjs'

export default class TripGenerator extends Generator {

  #db

  #SHAPE_MAPPING = {}
  #STOP_MAPPING = {}

  constructor(db, shapeMapping) {
    super(db)
    this.#db = db
    this.#SHAPE_MAPPING = shapeMapping
  }

  getCode(stopGTFSID, platform) {
    return `${stopGTFSID}_${platform}`
  }

  async setParentStops() {
    const dbStops = await this.#db.getCollection('stops')
    const trainStations = await dbStops.findDocuments({
      'bays.mode': {
        $in: ['metro train', 'regional train']
      }
    }, { bays: 1 }).toArray()

    for (const station of trainStations) {
      const relevantBays = station.bays.filter(bay => bay.parentStopGTFSID && bay.stopType === 'stop' && bay.fullStopName !== 'Connex')
      const setBayData = bay => {
        const code = this.getCode(bay.parentStopGTFSID, bay.platform || '')
        if (this.#STOP_MAPPING[code]) return

        this.#STOP_MAPPING[code] = bay.stopGTFSID
      }

      relevantBays.filter(bay => bay.mode === 'metro train').forEach(setBayData)
      relevantBays.filter(bay => bay.mode === 'regional train').forEach(setBayData)
    }
  }

  async generateFileContents(tripStream, stopTimesStream) {
    await this.setParentStops()

    const dbTimetables = await this.#db.getCollection('gtfs timetables')

    tripStream.write(`route_id,service_id,trip_id,block_id,shape_id\n`)
    stopTimesStream.write(`trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type,drop_off_type\n`)

    await dbTimetables.batchQuery({}, 100, trips => {
      for (const trip of trips) {
        const mode = trip.routeGTFSID.split('-')[0]
        tripStream.write(`"${trip.routeGTFSID}","${mode}_${trip.calendarID}","${trip.tripID}","${trip.block || ''}","${this.#SHAPE_MAPPING[trip.shapeID]}"\n`)
        trip.stopTimings.forEach((stop, i) => {
          const stopGTFSID = this.#STOP_MAPPING[this.getCode(stop.stopGTFSID, stop.platform || '')] || stop.stopGTFSID

          stopTimesStream.write(
            `"` + [
              trip.tripID,
              utils.getPTHHMMFromMinutesPastMidnight(stop.arrivalTimeMinutes) + ':00',
              utils.getPTHHMMFromMinutesPastMidnight(stop.departureTimeMinutes) + ':00',
              stopGTFSID,
              i,
              stop.stopConditions.pickup,
              stop.stopConditions.dropoff
            ].join('","')
            + `"\n`
          )
        })
      }
    })
  }

}