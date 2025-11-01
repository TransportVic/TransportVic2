export class GTFSRTrip {

  #operationDay
  #startTime
  #scheduleRelationship
  #routeID
  #tripID

  static SR_SCHEDULED = 0;
  static SR_ADDED = 1;
  static SR_UNSCHEDULED = 2;
  static SR_CANCELLED = 3;

  constructor(trip) {
    this.#operationDay = trip.start_date
    this.#scheduleRelationship = trip.schedule_relationship
    this.#routeID = trip.route_id.slice(-6, -1)
    this.#tripID = trip.trip_id

    let [_, startHour, startMinute] = trip.start_time.match(/^(\d\d):(\d\d)/)
    let finalStartHour = parseInt(startHour)
    this.#startTime = `${finalStartHour > 23 ? '0' + (finalStartHour - 24) : startHour}:${startMinute}`
  }

  getTDN() {}
  getOperationDay() { return this.#operationDay }
  getStartTime() { return this.#startTime }
  getScheduleRelationship() { return this.#scheduleRelationship }
  getRouteID() { return this.#routeID }
  getTripID() { return this.#tripID }

  static canProcess() { return false }

  static parse(trip) {
    let parsers = [ ScheduledRailGTFSRTrip, UnscheduledBusGTFSRTrip, BusGTFSRTrip, UnscheduledRailGTFSRTrip, GenericRailGTFSRTrip ]
    for (let parser of parsers) if (parser.canProcess(trip)) return new parser(trip)
  }

}

export class ScheduledRailGTFSRTrip extends GTFSRTrip {

  #tdn

  constructor(trip) {
    super(trip)
    this.#tdn = trip.trip_id.slice(-4)
  }

  static canProcess(trip) {
    return !!trip.trip_id.match(/^0[12]-[A-Z]{3}/)
  }

  getTDN() { return this.#tdn }

}

export class UnscheduledRailGTFSRTrip extends GTFSRTrip {

  #tdn

  constructor(trip) {
    super(trip)
    this.#tdn = trip.trip_id.match(/_(\w\d{3})_\d*$/)[1]
  }

  static canProcess(trip) {
    return !!trip.trip_id.match(/_\w\d{3}_\d*$/)
  }

  getTDN() { return this.#tdn }

}

export class GenericRailGTFSRTrip extends GTFSRTrip {

  #routeID

  constructor(trip) {
    super(trip)
    this.#routeID = trip.route_id.slice(0, 5)
  }

  static canProcess() { return true }

  getRouteID() { return this.#routeID }

}

export class BusGTFSRTrip extends GTFSRTrip {

  constructor(trip) {
    super(trip)
  }

  static canProcess(trip) {
    return !!trip.trip_id.match(/^\d+-\w+-\w?-1-\w+-\d+$/)
  }

  getTDN() { return this.getTripID() }
  getRouteID() { return '4-' + this.getTripID().split('-')[1] }

}

export class UnscheduledBusGTFSRTrip extends GTFSRTrip {

  #tdn
  #operationDay

  constructor(trip) {
    super(trip)
    const smartrakTripID = trip.trip_id.match(/_\w+_(\d+-\w+-\w?-1-\w+-\d+)_(\d+)$/)
    this.#tdn = smartrakTripID[1]
    this.#operationDay = smartrakTripID[2]
  }

  static canProcess(trip) {
    return !!trip.trip_id.match(/_\w+_\d+-\w+-\w?-1-\w+-\d+_\d+$/)
  }

  getTDN() { return this.#tdn }
  getOperationDay() { return this.#operationDay }

}