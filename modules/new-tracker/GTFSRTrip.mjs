export class MetroGTFSRTrip {

  constructor() {}
  getTDN() {}
  getOperationDay() {}
  getStartTime() {}

  static canProcess() { return false }

  static parse(trip) {
    let parsers = [ ScheduledMetroGTFSRTrip, UnscheduledMetroGTFSRTrip ]
    for (let parser of parsers) if (parser.canProcess(trip)) return new parser(trip)
  }

}

export class ScheduledMetroGTFSRTrip extends MetroGTFSRTrip {

  #tdn
  #operationDay
  #startTime

  constructor(trip) {
    super()
    this.#tdn = trip.trip_id.slice(-4)
    this.#operationDay = trip.start_date
    this.#startTime = trip.start_time
  }

  static canProcess(trip) {
    return !!trip.trip_id.match(/^02-[A-Z]{3}/)
  }

  getTDN() { return this.#tdn }
  getOperationDay() { return this.#operationDay }
  getStartTime() { return this.#startTime }

}

export class UnscheduledMetroGTFSRTrip extends MetroGTFSRTrip {

  #tdn
  #operationDay
  #startTime

  constructor(trip) {
    super()
    this.#tdn = trip.trip_id.match(/_(\w\d{3})_\d{8}$/)[1]
    this.#operationDay = trip.start_date
    this.#startTime = trip.start_time
  }

  static canProcess(trip) {
    return !!trip.trip_id.match(/_\w\d{3}_\d{8}$/)
  }

  getTDN() { return this.#tdn }
  getOperationDay() { return this.#operationDay }
  getStartTime() { return this.#startTime }

}