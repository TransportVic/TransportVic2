const utils = require('../../utils')

class TimetableStop {

  #stopName
  #stopNumber
  #stopGTFSID

  #schArrivalTime // TODO - separate arrival and departure times
  #schDepartureTime
  #estDepartureTime

  #platform
  #cancelled

  constructor(stopName, stopNumber, stopGTFSID, scheduledDepartureTime, estimatedDepartureTime) {
    this.#stopName = stopName
    this.#stopNumber = stopNumber
    this.#stopGTFSID = stopGTFSID
    this.#schDepartureTime = utils.parseTime(scheduledDepartureTime)
    this.#estDepartureTime = utils.parseTime(estimatedDepartureTime)
  }

  get stopName() { return this.#stopName }
  get stopNumber() { return this.#stopNumber }
  get stopName() { return this.#stopName }
  get stopGTFSID() { return this.#stopGTFSID }
  get platform() { return this.#platform }
  get cancelled() { return this.#cancelled }

  get scheduledDepartureTime() { return this.#schDepartureTime.clone() }
  get estimatedDepartureTime() { return this.#estDepartureTime ? this.#estDepartureTime.clone() : null }
  get actualDepartureTime() { return this.estimatedDepartureTime || this.scheduledDepartureTime }

  get arrivalTime() { return utils.formatHHMM(this.#estDepartureTime) }
  get departureTime() { return utils.formatHHMM(this.#estDepartureTime) }

}

module.exports = class LiveTimetable {

  #mode
  #operationDay
  #routeGTFSID
  #routeName
  #tripID
  #block

  #runID
  #direction

  #stops

  constructor(mode, operationDays, routeName, routeGTFSID, tripID, block) {
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
  get operationDay() { return utils.getYYYYMMDD(this.#operationDay) }
  get operationDayMoment() { return this.#operationDay.clone() }
  get tripID() { return this.#tripID }
  get block() { return this.#block }
  get direction() { return this.#direction }
  get runID() { return this.#runID }

  set direction(direction) { this.#direction = direction }
  set runID(runID) { this.#runID = runID }


  static fromDatabase(timetable) {
    let timetableInstance = new LiveTimetable(
      timetable.mode,
      timetable.operationDays,
      timetable.routeName,
      timetable.routeGTFSID,
      timetable.tripID,
      timetable.block
    )

    if (timetable.direction) timetableInstance.direction = timetable.direction
    if (timetable.runID) timetableInstance.runID = timetable.runID



    return timetableInstance
  }

}