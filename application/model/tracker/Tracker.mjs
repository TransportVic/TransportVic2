import utils from '../../../utils.js'

export default class Tracker {

  #db
  #coll

  constructor(db) {
    this.#db = db
    this.#coll = this.constructor.getTrackerCollection(db)
  }

  static getTrackerCollection(db) { return null }

  getFleetQuery(consist, date, options) {
    return {
      date,
      consist
    }
  }

  destructureOptions({ date = utils.getPTYYYYMMDD() } = {}) {
    return {
      date
    }
  }

  async getByFleet(consist, options) {
    const { date } = this.destructureOptions(options)
    return await this.#coll.findDocuments(this.getFleetQuery(consist, date, options))
      .sort({departureTime: 1})
      .toArray()
  }

  getRouteQuery(routeNumber, date, options) {
    return {
      date,
      routeNumber
    }
  }

  async getByRoute(routeNumber, options) {
    const { date } = this.destructureOptions(options)
    return await this.#coll.findDocuments(this.getRouteQuery(routeNumber, date, options))
      .sort({departureTime: 1})
      .toArray()
  }
}