import Tracker from './Tracker.mjs'
import utils from '../../../utils.js'
import busDestinations from '../../../additional-data/bus-destinations.json' with { type: 'json' }

export default class BusTracker extends Tracker {

  #regos
  constructor(db) {
    super(db)
    this.#regos = db.getCollection('bus regos')
  }

  static getTrackerCollection(db) { return db.getCollection('bus trips') }
  static getURLMode() { return 'bus' }

  async getBusRego(fleetNumber) {
    const busData = await this.#regos.findDocument({ fleetNumber })
    return busData ? busData.rego : null
  }

  setPrettyStopNames(trip) {
    const tripRoute = { routeNumber: trip.routeNumber, routeGTFSID: trip.routeGTFSID }
    const origin = utils.getPrettyStopName(trip.origin, busDestinations, tripRoute)
    const destination = utils.getPrettyStopName(trip.destination, busDestinations, tripRoute)

    return {
      ...trip,
      origin,
      destination
    }
  }

  async getFleetQuery(consist, options) {
    return {
      consist: await this.getBusRego(consist) || consist
    }
  }

  async getTripsByFleet(consist, options) {
    return (await super.getTripsByFleet(consist, options))
      .map(trip => this.setPrettyStopNames(trip))
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
      displayConsist: busData[trip.consist[0]] ? `#${busData[trip.consist[0]]}` : trip.consist[0]
    })).map(trip => this.setPrettyStopNames(trip))
  }

}