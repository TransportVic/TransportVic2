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