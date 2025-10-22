const utils = require('../../utils')
const allRouteStops = require('../../additional-data/metro-data/metro-routes.json')
const metroTypes = require('../../additional-data/metro-tracker/metro-types.json')

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

  #track
  #express

  #stopDistance

  constructor(operationDayMoment, stopName, suburb, stopNumber, stopGTFSID, scheduledDepartureTime, estimatedDepartureTime, { platform, cancelled, additional, allowPickup, allowDropoff, track, express, stopDistance }) {
    this.#operationDay = operationDayMoment
    this.#stopName = stopName
    this.#suburb = suburb
    this.#stopNumber = stopNumber
    this.#stopGTFSID = stopGTFSID
    this.scheduledDepartureTime = scheduledDepartureTime
    if (estimatedDepartureTime) this.estimatedDepartureTime = estimatedDepartureTime

    if (typeof stopDistance !== 'undefined') this.#stopDistance = stopDistance
    if (platform) this.#platform = platform
    if (cancelled) this.#cancelled = cancelled
    if (additional) this.#additional = additional
    if (typeof allowPickup !== 'undefined') this.#allowPickup = allowPickup
    if (typeof allowDropoff !== 'undefined') this.#allowDropoff = allowDropoff

    if (typeof track !== 'undefined') this.#track = track
    if (typeof express !== 'undefined') this.#express = express
  }

  get stopName() { return this.#stopName }
  get suburb() { return this.#suburb }
  get stopNumber() { return this.#stopNumber }
  get stopGTFSID() { return this.#stopGTFSID }
  get platform() { return this.#platform }
  get cancelled() { return this.#cancelled }
  get additional() { return this.#additional }
  get stopDistance() { return this.#stopDistance }

  get track() { return this.#track || null }
  get express() { return this.#express || false }

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
  get ptArrivalTime() { return utils.formatPTHHMMForOpDay(this.#schDepartureTime, this.#operationDay) }
  get arrivalTimeMinutes() { return this.#schDepartureTime.diff(this.#operationDay, 'minutes') }

  get departureTime() { return utils.formatHHMM(this.#schDepartureTime) }
  get ptDepartureTime() { return utils.formatPTHHMMForOpDay(this.#schDepartureTime, this.#operationDay) }
  get departureTimeMinutes() { return this.#schDepartureTime.diff(this.#operationDay, 'minutes') }

  get allowDropoff() { return this.#allowDropoff }
  get allowPickup() { return this.#allowPickup }

  set allowDropoff(dropoff) { this.#allowDropoff = dropoff }
  set allowPickup(pickup) { this.#allowPickup = pickup }

  toDatabase() {
    let returnData = {
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
      },
    }

    if (typeof this.#track !== 'undefined') returnData.track = this.#track
    if (typeof this.#express !== 'undefined') returnData.express = this.#express
    if (typeof this.#stopDistance !== 'undefined') returnData.stopDistance = this.#stopDistance

    return returnData
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
  #gtfsDirection
  
  #isRRB
  #runID
  #direction

  #vehicleForced = false
  #vehicle

  #stops = []

  #formedBy
  #forming

  logChanges = true
  changes = []
  newChanges = []

  #cancelled = false
  #additional = false

  #dataSource
  #circular
  #headsign
  #lastUpdated

  constructor(mode, operationDays, routeName, routeNumber, routeGTFSID, tripID, block, lastUpdated) {
    this.#mode = mode
    this.#operationDay = utils.parseDate(operationDays).startOf('day')
    this.#routeName = routeName
    this.#routeNumber = routeNumber
    this.#routeGTFSID = routeGTFSID
    this.#tripID = tripID
    this.#block = block
    this.#lastUpdated = lastUpdated || +new Date()
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
  get circular() { return this.#circular }
  get headsign() { return this.#headsign }
  get lastUpdated() { return new Date(this.#lastUpdated) }
  get gtfsDirection() { return this.#gtfsDirection }

  get vehicle() {
    if (this.#vehicle) {
      let returnData = {
        size: this.#vehicle.size,
        type: this.#vehicle.type,
        consist: this.#vehicle.consist,
      }
      if (this.#vehicle.icon) returnData.icon = this.#vehicle.icon
      if (this.#vehicle.forced) returnData.forced = this.#vehicle.forced
      if (this.#vehicle.variant) returnData.variant = this.#vehicle.variant
      return returnData
    }
    return null
  }

  #getVariant(rawVariants) {
    let variants = Array.from(new Set(rawVariants.filter(Boolean)).values())
    return variants.length === 1 ? variants[0] : variants.length > 1 ? 'Mixed' : undefined
  }

  #setConsist(consist, forceUpdate) {
    if (!forceUpdate) {
      if (!consist || !consist.length || this.#vehicleForced) return
      let hasFormingChange = this.changes.find(change => change.type === 'forming-change')
      if (hasFormingChange && this.vehicle && this.vehicle.consist) {
        let lastStop = this.stops[this.stops.length - 1]
        // Block changes in the last 10min of the trip
        if (lastStop && lastStop.scheduledDepartureTime.diff(utils.now(), 'minutes') < 10) return
      }
    }

    let type = metroTypes[consist[0]]
    let rearType = consist[3] && metroTypes[consist[3]]
    let typeDescriptor = type ? type.type : 'Unknown'

    let variant = this.#getVariant([ type?.variant, rearType?.variant ])
    let newVal = { size: consist.length, type: typeDescriptor, consist }
    if (variant) newVal.variant = variant

    if (this.#vehicle) {
      if (consist.length === 3 && this.#vehicle.size === 6) {
        if (this.#vehicle.consist.includes(consist[0])) return
      } else if (consist.length === 3 && this.#vehicle.size === 3 && typeDescriptor === this.#vehicle.type) {
        if (consist[0] === this.#vehicle.consist[0]) return
        let oldVal = { ...this.#vehicle, consist: this.#vehicle.consist.slice(0) }
        let newVal = { ...this.#vehicle, size: 6, consist: this.#vehicle.consist.concat(consist) }

        let variant = this.#getVariant([ oldVal?.variant, type?.variant ])
        if (variant) newVal.variant = variant

        this.addChange({
          type: 'veh-change',
          oldVal,
          newVal
        })

        this.#vehicle = newVal
        return
      } else if (consist.join('-') === this.#vehicle.consist.join('-')) return
    }

    this.addChange({
      type: 'veh-change',
      oldVal: this.#vehicle || null,
      newVal
    })

    this.#vehicle = newVal
  }

  set consist(consist) {
    this.#setConsist(consist, false)
  }

  set forcedVehicle(vehicle) {
    let oldVal = this.#vehicle ? { ...this.#vehicle, consist: this.#vehicle.consist.slice(0) } : null
    if (vehicle.consist && !vehicle.type && !vehicle.size) {
      this.#setConsist(vehicle.consist, true)
      this.#vehicle.forced = true
    } else {
      this.#vehicle = {
        size: vehicle.size,
        type: vehicle.type,
        consist: vehicle.consist,
        forced: true
      }
    }

    this.#vehicleForced = true
    if (vehicle.icon) this.#vehicle.icon = vehicle.icon

    let newVal = { ...this.#vehicle, consist: this.#vehicle.consist.slice(0) }
    this.addChange({
      type: 'veh-change',
      oldVal,
      newVal
    })
  }

  set direction(direction) { this.#direction = direction }
  set runID(runID) { this.#runID = runID }
  set isRRB(isRRB) { this.#isRRB = isRRB }
  set cancelled(cancelled) {
    if (typeof cancelled === 'undefined') return
    if (cancelled !== this.#cancelled) {
      this.addChange({
        type: 'trip-cancelled',
        oldVal: this.cancelled,
        newVal: cancelled
      })
    }
    this.#cancelled = cancelled
  }
  set additional(additional) { this.#additional = additional }
  set circular(circular) { this.#circular = circular }
  set headsign(headsign) { this.#headsign = headsign }
  set lastUpdated(lastUpdated) { this.#lastUpdated = +lastUpdated }

  get stops() { return this.#stops }

  get origin() { return this.#stops[0].stopName }
  get destination() { return this.#stops[this.#stops.length - 1].stopName }
  
  get departureTime() { return this.#stops[0].ptDepartureTime }
  get destinationArrivalTime() { return this.#stops[this.#stops.length - 1].ptArrivalTime }

  get formedBy() { return this.#formedBy }
  get forming() { return this.#forming }

  setModificationSource(source) { this.#dataSource = source }

  set formedBy(formedBy) {
    if (formedBy !== this.#formedBy) {
      this.addChange({
        type: 'formedby-change',
        oldVal: this.#formedBy,
        newVal: formedBy
      })
    }
    this.#formedBy = formedBy
  }
  set forming(forming) {
    if (forming !== this.#forming) {
      this.addChange({
        type: 'forming-change',
        oldVal: this.#forming,
        newVal: forming
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
      timetable.block,
      timetable.lastUpdated
    )

    if (timetable.shapeID) timetableInstance.#shapeID = timetable.shapeID
    if (timetable.direction) timetableInstance.#direction = timetable.direction
    if (timetable.runID) timetableInstance.#runID = timetable.runID
    if (timetable.cancelled) timetableInstance.#cancelled = timetable.cancelled
    if (timetable.additional) timetableInstance.#additional = timetable.additional
    if (timetable.circular) timetableInstance.#circular = timetable.circular
    if (timetable.headsign) timetableInstance.#headsign = timetable.headsign
    if (timetable.vehicle) {
      timetableInstance.#vehicle = timetable.vehicle
      timetableInstance.#vehicleForced = timetable.vehicle.forced || false
    }
    if (typeof timetable.gtfsDirection !== 'undefined') timetableInstance.#gtfsDirection = timetable.gtfsDirection

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
          allowPickup: stopData.stopConditions ? stopData.stopConditions.pickup === 0 : true,
          allowDropoff: stopData.stopConditions ? stopData.stopConditions.dropoff === 0 : true,
          track: stopData.track,
          express: stopData.express,
          stopDistance: typeof stopData.stopDistance !== 'undefined' ? parseFloat(stopData.stopDistance) : undefined
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
    let returnData = {
      mode: this.#mode,
      routeGTFSID: this.#routeGTFSID,
      operationDays: this.operationDay,
      tripID: this.#tripID,
      shapeID: this.#shapeID,
      block: this.#block,
      gtfsDirection: this.#gtfsDirection,
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
      additional: this.#additional,
      lastUpdated: this.#lastUpdated
    }

    if (typeof this.#circular !== 'undefined') returnData.circular = this.#circular
    if (typeof this.#headsign !== 'undefined') returnData.headsign = this.#headsign

    return returnData
  }

  getTrackerDatabaseKey() {
    if (!this.#vehicle) return null
    return {
      date: this.operationDay,
      runID: this.#runID
    }
  }

  toTrackerDatabase() {
    if (!this.#vehicle) return null

    let origin = this.stops.find(stop => !stop.cancelled)
    let destination = this.stops.findLast(stop => !stop.cancelled)

    let originStop, departureTime, destinationStop, arrivalTime

    if (!origin || !destination || (origin === destination)) {
      originStop = this.origin
      departureTime = this.departureTime
      destinationStop = this.destination
      arrivalTime = this.destinationArrivalTime
    } else {
      originStop = origin.stopName
      departureTime = origin.departureTime
      destinationStop = destination.stopName
      arrivalTime = destination.arrivalTime
    }

    let returnData = {
      date: this.operationDay,
      routeGTFSID: this.routeGTFSID,
      routeName: this.routeName,
      runID: this.#runID,
      origin: originStop.slice(0, -16),
      destination: destinationStop.slice(0, -16),
      departureTime: departureTime,
      destinationArrivalTime: arrivalTime,
      consist: this.#vehicle.consist
    }

    if (this.#mode === 'bus') {
      returnData.origin = originStop
      returnData.destination = destinationStop
    }
    if (this.#routeNumber) {
      returnData.routeNumber = this.#routeNumber
    }

    if (this.#vehicleForced) {
      returnData.forced = true
      if (this.#vehicle.icon) returnData.icon = this.#vehicle.icon
      if (this.#vehicle.size) returnData.size = this.#vehicle.size
    }
    return returnData
  }

  #sortStopsByTimetable() {
    return this.#stops = this.#stops.sort((a, b) => a.scheduledDepartureTime - b.scheduledDepartureTime)
  }

  sortStops() {
    let routeStops = allRouteStops[this.#routeName]
    if (!routeStops) return this.#sortStopsByTimetable()

    let hasMissingStop = false
    let stopIndexes = this.#stops.reduce((acc, stop) => {
      let index = routeStops.indexOf(stop.stopName.slice(0, -16))
      if (index === -1) hasMissingStop = true
      acc[stop.stopName] = index
      return acc
    }, {})

    if (hasMissingStop) return this.#sortStopsByTimetable()

    let isUp = this.#direction === 'Up'
    if (isUp) {
      this.#stops.sort((prev, next) => {
        return stopIndexes[prev.stopName] - stopIndexes[next.stopName]
      })
    } else {
      this.#stops.sort((prev, next) => {
        return stopIndexes[next.stopName] - stopIndexes[prev.stopName]
      })
    }
  }

  getStopNames() {
    return this.#stops.map(stop => stop.stopName)
  }

  addChange(data) {
    let change = {
      ...data,
      timestamp: new Date(),
      source: this.#dataSource
    }
    if (this.logChanges) this.changes.push(change)
    this.newChanges.push(change)
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
      let existingSchTime = matchingStop.scheduledDepartureTime.toISOString()
      if (stopData.scheduledDepartureTime && (existingSchTime !== stopData.scheduledDepartureTime)) {
        matchingStop.scheduledDepartureTime = stopData.scheduledDepartureTime
        this.addChange({
          type: 'stop-time-change',
          stopName: matchingStop.stopName,
          oldVal: existingSchTime,
          newVal: stopData.scheduledDepartureTime
        })
      }

      if (stopData.estimatedDepartureTime) matchingStop.estimatedDepartureTime = stopData.estimatedDepartureTime
      if (stopData.platform) {
        let newPlatform = stopData.platform.toString()
        if (matchingStop.platform !== newPlatform) this.addChange({
          type: 'platform-change',
          stopGTFSID: matchingStop.stopGTFSID,
          oldVal: matchingStop.platform,
          newVal: newPlatform
        })
        matchingStop.platform = newPlatform
      }

      if (typeof stopData.cancelled !== 'undefined') {
        if (matchingStop.cancelled !== stopData.cancelled) this.addChange({
          type: 'stop-cancelled',
          stopGTFSID: matchingStop.stopGTFSID,
          oldVal: matchingStop.cancelled,
          newVal: stopData.cancelled
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

      this.addChange({
        type: 'add-stop',
        stopGTFSID: stopData.stopGTFSID
      })
      this.#stops.push(stop)
    }
  }

}