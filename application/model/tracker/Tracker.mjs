import utils from '../../../utils.js'

export default class Tracker {

  #db
  #coll

  constructor(db) {
    this.#db = db
    this.#coll = this.constructor.getTrackerCollection(db)
  }

  static getTrackerCollection(db) { return null }

  async getByFleet(fleet, { date = utils.getPTYYYYMMDD() } = {}) {

  }

}