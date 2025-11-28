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

    const tripsToday = await this.#coll.findDocuments(query)
      .sort({departureTime: 1})
      .toArray()

    return tripsToday
  }

}