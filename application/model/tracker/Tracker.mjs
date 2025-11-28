import utils from '../../../utils.js'
import async from 'async'

export default class Tracker {

  #db
  #coll

  constructor(db) {
    this.#db = db
    this.#coll = this.constructor.getTrackerCollection(db)
  }

  static getTrackerCollection(db) { return null }

  getDate({ date = utils.getPTYYYYMMDD() } = {}) {
    return date
  }

  async searchWithDate(query, date) {
    return await this.#coll.findDocuments({ date, ...query })
      .sort({ departureTime: 1 })
      .toArray()
  }

  getFleetQuery(consist, options) {
    return {
      consist
    }
  }


  async getTripsByFleet(consist, options) {
    const date = this.getDate(options)
    return await this.searchWithDate(this.getFleetQuery(consist, options), date)
  }

  getRouteQuery(routeNumber, options) {
    return {
      routeNumber
    }
  }

  async getTripsByRoute(routeNumber, options) {
    const date = this.getDate(options)
    return await this.searchWithDate(this.getRouteQuery(routeNumber, options), date)
  }

  async getHistoryDates(query) {
    return (await this.#coll.distinct('date', query)).sort((a, b) => b.localeCompare(a))
  }

  async getHistory(query, field) {
    const allDates = await this.getHistoryDates(query)
    return await async.map(allDates, async date => {
      const humanDate = date.slice(6, 8) + '/' + date.slice(4, 6) + '/' + date.slice(0, 4)
      const distinct = await this.#coll.distinct(field, { date, ...query })

      return {
        date,
        humanDate,
        data: distinct.sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b))
      }
    })
  }
}