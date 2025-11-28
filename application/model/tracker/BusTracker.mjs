import Tracker from './Tracker.mjs'

export default class BusTracker extends Tracker {

  #regos
  constructor(db) {
    super(db)
    this.#regos = db.getCollection('bus regos')
  }

  static getTrackerCollection(db) { return db.getCollection('bus trips') }

  async getTripsByFleet(consist, options) {
    const busData = await this.#regos.findDocument({ fleetNumber: consist })
    const queryConsist = busData ? busData.rego : consist
    return await super.getTripsByFleet(queryConsist, options)
  }

  async getTripsByRoute(routeNumber, options) {
    const trips = await super.getTripsByRoute(routeNumber, options)
    const uniqueRegos = Array.from(new Set(trips.flatMap(trip => trip.consist)))
    const busData = (await this.#regos.findDocuments({ rego: { $in: uniqueRegos } }).toArray()).reduce((acc, bus) => ({
      ...acc,
      [bus.rego]: bus.fleetNumber
    }), {})

    return trips.map(trip => ({
      ...trip,
      displayConsist: busData[trip.consist[0]] ? `#${busData[trip.consist[0]]}` : `@${trip.consist[0]}`
    }))
  }

}