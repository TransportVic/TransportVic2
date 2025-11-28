import utils from '../../../utils.js'

export default class Tracker {

  #db
  #coll

  constructor(db) {
    this.#db = db
    this.#coll = this.constructor.getTrackerCollection(db)
  }

  static getTrackerCollection(db) { return null }

  async getByFleet(consist, { date = utils.getPTYYYYMMDD() } = {}) {
    const query = {
      date,
      consist
    }

    return await this.#coll.findDocuments(query)
      .sort({departureTime: 1})
      .toArray()
  }

  async getByRoute(routeNumber, { date = utils.getPTYYYYMMDD() } = {}) {
    const query = {
      date,
      routeNumber
    }

    return await this.#coll.findDocuments(query)
      .sort({departureTime: 1})
      .toArray()
  }
}