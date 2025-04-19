const utils = require('../../utils')

module.exports = class LiveTimetable {

  #mode
  #operationDay
  #routeGTFSID
  #routeName
  #tripID
  #block

  constructor(mode, operationDays, routeName, routeGTFSID, tripID, block) {
    this.#mode = mode
    this.#operationDay = utils.parseDate(operationDays)
    this.#routeName = routeName
    this.#routeGTFSID = routeGTFSID
    this.#tripID = tripID
    this.#block = block
  }

  static fromDatabase(timetable) {
    let timetableInstance = new LiveTimetable(
      timetable.mode,
      timetable.operationDays,
      timetable.routeName,
      timetable.routeGTFSID,
      timetable.tripID,
      timetable.block
    )

    return timetableInstance
  }

}