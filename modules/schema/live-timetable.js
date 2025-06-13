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
  #additional = false

  #allowPickup = true
  #allowDropoff = true

  constructor(operationDayMoment, stopName, suburb, stopNumber, stopGTFSID, scheduledDepartureTime, estimatedDepartureTime, { platform, cancelled, additional, allowPickup, allowDropoff }) {
    this.#operationDay = operationDayMoment
    this.#stopName = stopName
    this.#suburb = suburb
    this.#stopNumber = stopNumber
    this.#stopGTFSID = stopGTFSID
    this.scheduledDepartureTime = scheduledDepartureTime
    if (estimatedDepartureTime) this.estimatedDepartureTime = estimatedDepartureTime

    if (platform) this.#platform = platform
    if (cancelled) this.#cancelled = cancelled
    if (additional) this.#additional = additional
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
  get additional() { return this.#additional }

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
  set cancelled(cancelled) { this.#cancelled = cancelled }
  set additional(additional) { this.#additional = additional }

  get arrivalTime() { return utils.formatHHMM(this.#schDepartureTime) }
  get arrivalTimeMinutes() { return this.#schDepartureTime.diff(this.#operationDay, 'minutes') }
  get departureTime() { return utils.formatHHMM(this.#schDepartureTime) }
  get departureTimeMinutes() { return this.#schDepartureTime.diff(this.#operationDay, 'minutes') }

  get allowDropoff() { return this.#allowDropoff }
  get allowPickup() { return this.#allowPickup }

  set allowDropoff(dropoff) { this.#allowDropoff = dropoff }
  set allowPickup(pickup) { this.#allowPickup = pickup }

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
      additional: this.#additional,
      stopConditions: {
        pickup: this.#allowPickup ? 0 : 1,
        dropoff: this.allowDropoff ? 0 : 1
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

  #vehicle

  #stops = []

  #formedBy
  #forming

  logChanges = true
  changes = []

  #cancelled = false
  #additional = false

  #dataSource

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

  get vehicle() {
    if (this.#vehicle) {
      return {
        size: this.#vehicle.size,
        type: this.#vehicle.type,
        consist: this.#vehicle.consist
      }
    }
    return null
  }

  set direction(direction) { this.#direction = direction }
  set runID(runID) { this.#runID = runID }
  set isRRB(isRRB) { this.#isRRB = isRRB }
  set cancelled(cancelled) {
    if (typeof cancelled === 'undefined') return
    if (cancelled !== this.#cancelled && this.logChanges) {
      this.changes.push({
        type: 'trip-cancelled',
        oldVal: this.cancelled,
        newVal: cancelled,
        timestamp: new Date().toISOString(),
        source: this.#dataSource
      })
    }
    this.#cancelled = cancelled
  }
  set additional(additional) { this.#additional = additional }

  get stops() { return this.#stops }

  get origin() { return this.#stops[0].stopName }
  get destination() { return this.#stops[this.#stops.length - 1].stopName }
  
  get departureTime() { return this.#stops[0].departureTime }
  get destinationArrivalTime() { return this.#stops[this.#stops.length - 1].arrivalTime }

  get formedBy() { return this.#formedBy }
  get forming() { return this.#forming }

  setModificationSource(source) { this.#dataSource = source }

  set formedBy(formedBy) {
    if (formedBy !== this.#formedBy && this.logChanges) {
      this.changes.push({
        type: 'formedby-change',
        oldVal: this.#formedBy,
        newVal: formedBy,
        timestamp: new Date().toISOString(),
        source: this.#dataSource
      })
    }
    this.#formedBy = formedBy
  }
  set forming(forming) {
    if (forming !== this.#forming && this.logChanges) {
      this.changes.push({
        type: 'forming-change',
        oldVal: this.#forming,
        newVal: forming,
        timestamp: new Date().toISOString(),
        source: this.#dataSource
      })
    }
    this.#forming = forming
  }

  get isRRB() { return this.#isRRB }
  get cancelled() { return this.#cancelled }
  get additional() { return this.#additional }

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
    if (timetable.cancelled) timetableInstance.#cancelled = timetable.cancelled
    if (timetable.additional) timetableInstance.#additional = timetable.additional
    if (timetable.vehicle) timetableInstance.#vehicle = timetable.vehicle

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
          additional: stopData.additional,
          allowPickup: stopData.stopConditions.pickup === 0,
          allowDropoff: stopData.stopConditions.dropoff === 0
        }
      )

      timetableInstance.#stops.push(stop)
    }

    if (timetable.formedBy) timetableInstance.#formedBy = timetable.formedBy
    if (timetable.forming) timetableInstance.#forming = timetable.forming
    if (typeof timetable.isRailReplacementBus !== 'undefined') timetableInstance.#isRRB = timetable.isRailReplacementBus
    if (timetable.changes) timetableInstance.changes = timetable.changes

    return timetableInstance
  }

  getDBKey() {
    return {
      mode: this.#mode,
      operationDays: this.operationDay,
      runID: this.#runID
    }
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
      vehicle: this.#vehicle,
      direction: this.#direction,
      routeName: this.#routeName,
      routeNumber: this.#routeNumber,
      origin: this.origin,
      destination: this.destination,
      departureTime: this.departureTime,
      destinationArrivalTime: this.destinationArrivalTime,
      stopTimings: this.#stops.map(stop => stop.toDatabase()),
      formedBy: this.#formedBy,
      forming: this.#forming,
      changes: this.changes,
      cancelled: this.#cancelled,
      additional: this.#additional
    }
  }

  sortStops() {
    this.#stops = this.#stops.sort((a, b) => a.scheduledDepartureTime - b.scheduledDepartureTime)
  }

  getStopNames() {
    return this.#stops.map(stop => stop.stopName)
  }

  updateStopByName(stopName, stopData, { prefSchTime, visitNum } = {}) {
    let matchingStops = this.#stops.filter(stop => {
      if (prefSchTime) {
        let prefISOTime = utils.parseTime(prefSchTime).toISOString()
        let stopISOTime = stop.scheduledDepartureTime.toISOString()
        if (prefISOTime !== stopISOTime) return false
      }

      return stop.stopName === stopName
    })

    if (typeof visitNum === 'undefined') visitNum = 1
    let matchingStop = matchingStops[visitNum - 1]

    if (matchingStop) {
      if (stopData.scheduledDepartureTime) matchingStop.scheduledDepartureTime = stopData.scheduledDepartureTime
      if (stopData.estimatedDepartureTime) matchingStop.estimatedDepartureTime = stopData.estimatedDepartureTime
      if (stopData.platform) {
        let newPlatform = stopData.platform.toString()
        if (matchingStop.platform !== newPlatform && this.logChanges) this.changes.push({
          type: 'platform-change',
          stopGTFSID: matchingStop.stopGTFSID,
          oldVal: matchingStop.platform,
          newVal: newPlatform,
          timestamp: new Date().toISOString(),
          source: this.#dataSource
        })
        matchingStop.platform = newPlatform
      }

      if (typeof stopData.cancelled !== 'undefined') {
        if (matchingStop.cancelled !== stopData.cancelled && this.logChanges) this.changes.push({
          type: 'stop-cancelled',
          stopGTFSID: matchingStop.stopGTFSID,
          oldVal: matchingStop.cancelled,
          newVal: stopData.cancelled,
          timestamp: new Date().toISOString(),
          source: this.#dataSource
        })
        matchingStop.cancelled = stopData.cancelled
      }
    } else {
      if (!stopData.scheduledDepartureTime && stopData.estimatedDepartureTime) {
        stopData.scheduledDepartureTime = stopData.estimatedDepartureTime
      }
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
          cancelled: stopData.cancelled,
          additional: stopData.additional
        }
      )

      if (this.logChanges) this.changes.push({
        type: 'add-stop',
        stopGTFSID: stopData.stopGTFSID,
        timestamp: new Date().toISOString(),
        source: this.#dataSource
      })
      this.#stops.push(stop)
    }
  }

}