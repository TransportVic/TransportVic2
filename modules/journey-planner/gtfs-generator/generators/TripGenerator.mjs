import utils from '../../../../utils.js'
import Generator from './Generator.mjs'

export default class TripGenerator extends Generator {

  #db

  #SHAPE_MAPPING = {}

  constructor(db, shapeMapping) {
    super(db)
    this.#db = db
    this.#SHAPE_MAPPING = shapeMapping
  }

  async generateFileContents(tripStream, stopTimesStream) {
    const dbTimetables = await this.#db.getCollection('gtfs timetables')

    tripStream.write(`route_id,service_id,trip_id,block_id,shape_id\n`)
    stopTimesStream.write(`trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type,drop_off_type\n`)

    await dbTimetables.batchQuery({}, 100, trips => {
      for (const trip of trips) {
        const mode = trip.routeGTFSID.split('-')[0]
        tripStream.write(`"${trip.routeGTFSID}","${mode}_${trip.calendarID}","${trip.tripID}","${trip.block || ''}","${this.#SHAPE_MAPPING[trip.shapeID]}"\n`)
        trip.stopTimings.forEach((stop, i) => {
          stopTimesStream.write(
            `"` + [
              trip.tripID,
              utils.getPTHHMMFromMinutesPastMidnight(stop.arrivalTimeMinutes) + ':00',
              utils.getPTHHMMFromMinutesPastMidnight(stop.departureTimeMinutes) + ':00',
              stop.stopGTFSID,
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