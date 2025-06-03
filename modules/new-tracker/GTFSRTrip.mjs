export class MetroGTFSRTrip {

  #operationDay
  #startTime

  constructor(trip) {
    this.#operationDay = trip.start_date
    this.#startTime = trip.start_time
  }

  getTDN() {}
  getOperationDay() { return this.#operationDay }
  getStartTime() { return this.#startTime }

  static canProcess() { return false }

  static parse(trip) {
    let parsers = [ ScheduledMetroGTFSRTrip, UnscheduledMetroGTFSRTrip ]
    for (let parser of parsers) if (parser.canProcess(trip)) return new parser(trip)
  }

}

export class ScheduledMetroGTFSRTrip extends MetroGTFSRTrip {

  #tdn

  constructor(trip) {
    super(trip)
    this.#tdn = trip.trip_id.slice(-4)
  }

  static canProcess(trip) {
    return !!trip.trip_id.match(/^02-[A-Z]{3}/)
  }

  getTDN() { return this.#tdn }

}

export class UnscheduledMetroGTFSRTrip extends MetroGTFSRTrip {

  #tdn

  constructor(trip) {
    super(trip)
    this.#tdn = trip.trip_id.match(/_(\w\d{3})_\d{8}$/)[1]
  }

  static canProcess(trip) {
    return !!trip.trip_id.match(/_\w\d{3}_\d{8}$/)
  }

  getTDN() { return this.#tdn }

}