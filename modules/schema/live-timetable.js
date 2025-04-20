const utils = require('../../utils')

class TimetableStop {

  #operationDay

  #stopName
  #suburb
  #stopNumber
  #stopGTFSID

  #schArrivalTime // TODO - separate arrival and departure times
  #schDepartureTime
  #estDepartureTime

  #platform
  #cancelled = false

  #allowPickup = true
  #allowDropoff = true

  constructor(operationDayMoment, stopName, suburb, stopNumber, stopGTFSID, scheduledDepartureTime, estimatedDepartureTime, { platform, cancelled, allowPickup, allowDropoff }) {
    this.#operationDay = operationDayMoment
    this.#stopName = stopName
    this.#suburb = suburb
    this.#stopNumber = stopNumber
    this.#stopGTFSID = stopGTFSID
    this.scheduledDepartureTime = scheduledDepartureTime
    if (estimatedDepartureTime) this.estimatedDepartureTime = estimatedDepartureTime

    if (platform) this.#platform = platform
    if (cancelled) this.#cancelled = cancelled
    if (typeof allowPickup !== 'undefined') this.#allowPickup = allowPickup
    if (typeof allowDropoff !== 'undefined') this.#allowDropoff = allowDropoff
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

  set scheduledDepartureTime(scheduledDepartureTime) {
    this.#schDepartureTime = utils.parseTime(scheduledDepartureTime)
  }

  set estimatedDepartureTime(estimatedDepartureTime) {
    if (estimatedDepartureTime) {
      this.#estDepartureTime = utils.parseTime(estimatedDepartureTime)
    } else {
      this.#estDepartureTime = null
    }
  }

  set platform(platform) { this.#platform = platform }

  get arrivalTime() { return utils.formatHHMM(this.#schDepartureTime) }
  get arrivalTimeMinutes() { return this.#schDepartureTime.diff(this.#operationDay, 'minutes') }
  get departureTime() { return utils.formatHHMM(this.#schDepartureTime) }
  get departureTimeMinutes() { return this.#schDepartureTime.diff(this.#operationDay, 'minutes') }

  get allowDropoff() { return this.#allowDropoff }
  get allowPickup() { return this.#allowPickup }

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
      estimatedDepartureTime: this.#estDepartureTime ? this.estimatedDepartureTime.toISOString() : null,
      scheduledDepartureTime: this.scheduledDepartureTime.toISOString(),
      actualDepartureTimeMS: +this.actualDepartureTime,
      platform: this.#platform,
      cancelled: this.#cancelled,
      stopConditions: {
        pickup: this.#allowPickup ? '0' : '1',
        dropoff: this.allowDropoff ? '0' : '1'
      }
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
    this.#operationDay = utils.parseDate(operationDays).startOf('day')
    this.#routeName = routeName
    this.#routeNumber = routeNumber
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

  set direction(direction) { this.#direction = direction }
  set runID(runID) { this.#runID = runID }
  set isRRB(isRRB) { this.#isRRB = isRRB }

  get stops() { return this.#stops }

  get origin() { return this.#stops[0].stopName }
  get destination() { return this.#stops[this.#stops.length - 1].stopName }
  
  get departureTime() { return this.#stops[0].departureTime }
  get destinationArrivalTime() { return this.#stops[this.#stops.length - 1].arrivalTime }

  get formedBy() { return this.#formedBy }
  get forming() { return this.#forming }

  set formedBy(formedBy) { this.#formedBy = formedBy } 
  set forming(forming) { this.#forming = forming } 

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
        timetableInstance.operationDayMoment,
        stopData.stopName,
        stopData.suburb,
        stopData.stopNumber,
        stopData.stopGTFSID,
        stopData.scheduledDepartureTime,
        stopData.estimatedDepartureTime,
        {
          platform: stopData.platform,
          cancelled: stopData.cancelled,
          allowPickup: stopData.stopConditions.pickup === '0',
          allowDropoff: stopData.stopConditions.dropoff === '0'
        }
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
      destinationArrivalTime: this.destinationArrivalTime,
      stopTimings: this.#stops.map(stop => stop.toDatabase()),
      formedBy: this.#formedBy,
      forming: this.#forming
    }
  }

  updateStopByName(stopName, stopData, prefSchTime) {
    let matchingStop = this.#stops.find(stop => {
      if (prefSchTime) {
        let prefISOTime = utils.parseTime(prefSchTime).toISOString()
        let stopISOTime = stop.scheduledDepartureTime.toISOString()
        if (prefISOTime !== stopISOTime) return false
      }

      return stop.stopName === stopName
    })


    if (matchingStop) {
      if (stopData.scheduledDepartureTime) matchingStop.scheduledDepartureTime = stopData.scheduledDepartureTime
      if (stopData.estimatedDepartureTime) matchingStop.estimatedDepartureTime = stopData.estimatedDepartureTime
      if (stopData.platform) matchingStop.platform = stopData.platform.toString()
      if (typeof stopData.cancelled !== 'undefined') matchingStop.cancelled = stopData.cancelled
    } else {
      let stop = new TimetableStop(
        this.#operationDay.clone(),
        stopName,
        stopData.suburb,
        stopData.stopNumber,
        stopData.stopGTFSID,
        stopData.scheduledDepartureTime,
        stopData.estimatedDepartureTime,
        {
          platform: stopData.platform,
          cancelled: stopData.cancelled
        }
      )

      this.#stops.push(stop)
    }
  }

}