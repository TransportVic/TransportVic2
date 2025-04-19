const utils = require('../../utils')

class TimetableStop {

  #stopName
  #suburb
  #stopNumber
  #stopGTFSID

  #schArrivalTime // TODO - separate arrival and departure times
  #schDepartureTime
  #estDepartureTime

  #platform
  #cancelled

  constructor(stopName, suburb, stopNumber, stopGTFSID, scheduledDepartureTime, estimatedDepartureTime, platform) {
    this.#stopName = stopName
    this.#suburb = suburb
    this.#stopNumber = stopNumber
    this.#stopGTFSID = stopGTFSID
    this.#schDepartureTime = utils.parseTime(scheduledDepartureTime)
    this.#estDepartureTime = utils.parseTime(estimatedDepartureTime)

    if (platform) this.#platform = platform
  }

  get stopName() { return this.#stopName }
  get suburb() { return this.#suburb }
  get stopNumber() { return this.#stopNumber }
  get stopName() { return this.#stopName }
  get stopGTFSID() { return this.#stopGTFSID }
  get platform() { return this.#platform }
  get cancelled() { return this.#cancelled }

  get scheduledDepartureTime() { return this.#schDepartureTime.clone() }
  get estimatedDepartureTime() { return this.#estDepartureTime ? this.#estDepartureTime.clone() : null }
  get actualDepartureTime() { return this.estimatedDepartureTime || this.scheduledDepartureTime }

  get arrivalTime() { return utils.formatHHMM(this.#schDepartureTime) }
  get departureTime() { return utils.formatHHMM(this.#schDepartureTime) }

  toDatabase() {
    return {
      stopName: this.#stopName,
      stopNumber: this.#stopNumber,
      suburb: this.#suburb,
      stopGTFSID: this.#stopGTFSID,
      arrivalTime: this.arrivalTime,
      arrivalTimeMinutes: this.arrivalTimeMinutes,
      departureTime: this.departureTime,
      departureTimeMinutes: this.departureTimeMinutes,
      estimatedDepartureTime: this.estimatedDepartureTime.toISOString(),
      scheduledDepartureTime: this.estimatedDepartureTime.toISOString(),
      actualDepartureTimeMS: +this.actualDepartureTime,
      platform: this.#platform,
      cancelled: this.#cancelled,
    }
  }

}

module.exports = class LiveTimetable {

  #mode
  #operationDay
  #routeGTFSID
  #routeName
  #routeNumber
  #tripID
  #shapeID
  #block
  
  #isRRB
  #runID
  #direction

  #stops = []

  #formedBy
  #forming

  constructor(mode, operationDays, routeName, routeNumber, routeGTFSID, tripID, block) {
    this.#mode = mode
    this.#operationDay = utils.parseDate(operationDays)
    this.#routeName = routeName
    this.#routeGTFSID = routeGTFSID
    this.#tripID = tripID
    this.#block = block
  }

  get mode() { return this.#mode }
  get routeGTFSID() { return this.#routeGTFSID }
  get routeName() { return this.#routeName }
  get routeNumber() { return this.#routeNumber }
  get operationDay() { return utils.getYYYYMMDD(this.#operationDay) }
  get operationDayMoment() { return this.#operationDay.clone() }
  get tripID() { return this.#tripID }
  get shapeID() { return this.#shapeID }
  get block() { return this.#block }
  get direction() { return this.#direction }
  get runID() { return this.#runID }

  get stops() { return this.#stops }

  get origin() { return this.#stops[0].stopName }
  get destination() { return this.#stops[this.#stops.length - 1].stopName }
  
  get departureTime() { return this.#stops[0].departureTime }
  get destinationArrivalTime() { return this.#stops[this.#stops.length - 1].arrivalTime }

  get formedBy() { return this.#formedBy }
  get forming() { return this.#forming }

  get isRRB() { return this.#isRRB }

  static fromDatabase(timetable) {
    let timetableInstance = new LiveTimetable(
      timetable.mode,
      timetable.operationDays,
      timetable.routeName,
      timetable.routeNumber,
      timetable.routeGTFSID,
      timetable.tripID,
      timetable.block
    )

    if (timetable.shapeID) timetableInstance.#shapeID = timetable.shapeID
    if (timetable.direction) timetableInstance.#direction = timetable.direction
    if (timetable.runID) timetableInstance.#runID = timetable.runID

    for (let stopData of timetable.stopTimings) {
      let stop = new TimetableStop(
        stopData.stopName,
        stopData.suburb,
        stopData.stopNumber,
        stopData.stopGTFSID,
        stopData.scheduledDepartureTime,
        stopData.estimatedDepartureTime,
        stopData.platform
      )

      timetableInstance.#stops.push(stop)
    }

    if (timetable.formedBy) timetableInstance.#formedBy = timetable.formedBy
    if (timetable.forming) timetableInstance.#forming = timetable.forming
    if (typeof timetable.isRailReplacementBus !== 'undefined') timetableInstance.#isRRB = timetable.isRailReplacementBus

    return timetableInstance
  }

  toDatabase() {
    return {
      mode: this.#mode,
      routeGTFSID: this.#routeGTFSID,
      operationDays: this.operationDay,
      tripID: this.#tripID,
      shapeID: this.#shapeID,
      block: this.#block,
      gtfsDirection: undefined,
      runID: this.#runID,
      isRailReplacementBus: this.#isRRB,
      direction: this.#direction,
      routeName: this.#routeName,
      routeNumber: this.#routeNumber,

      origin: this.origin,
      destination: this.destination,
      departureTime: this.departureTime,
      destinationArrivalTime: this.destinationArrivalTime
    }
  }

}