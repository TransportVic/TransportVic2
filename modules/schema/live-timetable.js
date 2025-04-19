const utils = require('../../utils')

module.exports = class LiveTimetable {

  #mode
  #operationDay
  #routeGTFSID
  #routeName
  #tripID
  #block

  #runID
  #direction

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