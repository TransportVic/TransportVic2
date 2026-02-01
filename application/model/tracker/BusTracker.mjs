import Tracker from './Tracker.mjs'
import utils from '../../../utils.mjs'
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
    if (!fleetNumber) return null
    const busData = await this.#regos.findDocument({ fleetNumber })
    return busData ? busData.rego : null
  }

  async getBusData(query) {
    if (!query) return null
    return await this.#regos.findDocument({ rego: query }) || await this.#regos.findDocument({ fleetNumber: query })
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

  async bulkSearchRegos(regos) {
    const uniqueRegos = Array.from(new Set(regos))
    return (await this.#regos.findDocuments({ rego: { $in: uniqueRegos } }).toArray()).reduce((acc, bus) => ({
      ...acc,
      [bus.rego]: bus.fleetNumber
    }), {})
  }

  async getTripsByRoute(routeNumber, options) {
    const trips = await super.getTripsByRoute(routeNumber, options)
    const busData = await this.bulkSearchRegos(trips.flatMap(trip => trip.consist))

    return trips.map(trip => ({
      ...trip,
      displayConsist: busData[trip.consist[0]] ? `#${busData[trip.consist[0]]}` : trip.consist[0]
    })).map(trip => this.setPrettyStopNames(trip))
  }

  async setRegosOnHistory(history) {
    const busData = await this.bulkSearchRegos(history.flatMap(day => day.data))
    return history.map(day => ({
      ...day,
      data: (() => {
        const fleetBuses = day.data.filter(rego => busData[rego]).map(rego => busData[rego])
        const regoBuses = day.data.filter(rego => !busData[rego])
        return regoBuses.sort((a, b) => a.localeCompare(b)).concat(fleetBuses.sort((a, b) => parseInt(a.match(/(\d+)/)[0]) - parseInt(b.match(/(\d+)/)[0])))
      })()
    }))
  }

}