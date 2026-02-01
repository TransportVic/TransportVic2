import utils from '../../../utils.mjs'
import async from 'async'

export default class Tracker {

  #db
  #coll

  constructor(db) {
    this.#db = db
    this.#coll = this.constructor.getTrackerCollection(db)
  }

  static getTrackerCollection(db) { throw new Error() }
  static getURLMode() { throw new Error() }

  getDefaultDay() { return utils.getPTYYYYMMDD(utils.now()) }

  getDate({ date } = {}) {
    return date || this.getDefaultDay()
  }

  getURLStopName(stopName) {
    return utils.encodeName(stopName)
  }
  
  setTripData(trip, checkActive, currentTime) {
    const tripURL = '/' + [
      this.constructor.getURLMode(), 'run',
      this.getURLStopName(trip.origin), trip.departureTime,
      this.getURLStopName(trip.destination), trip.destinationArrivalTime,
      trip.date
    ].join('/')

    const arrivalMinutes = utils.getMinutesPastMidnightFromHHMM(trip.destinationArrivalTime)
    const destinationArrivalMoment = utils.parseDate(trip.date).add(arrivalMinutes, 'minutes')

    return {
      ...trip,
      tripURL, destinationArrivalMoment,
      active: checkActive ? destinationArrivalMoment >= currentTime : true
    }
  }

  async searchWithDate(query, date) {
    return (await this.#coll.findDocuments({ date, ...query })
      .sort({ departureTime: 1 })
      .toArray())
      .map(trip => this.setTripData(trip, date === this.getDefaultDay(), utils.now()))
  }

  async getFleetQuery(consist, options) {
    return {
      consist
    }
  }

  async getTripsByFleet(consist, options) {
    const date = this.getDate(options)
    return await this.searchWithDate(await this.getFleetQuery(consist, options), date)
  }

  async getRouteQuery(routeNumber, options) {
    return {
      routeNumber
    }
  }

  async getTripsByRoute(routeNumber, options) {
    const date = this.getDate(options)
    return await this.searchWithDate(await this.getRouteQuery(routeNumber, options), date)
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