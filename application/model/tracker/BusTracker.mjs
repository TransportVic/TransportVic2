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

}