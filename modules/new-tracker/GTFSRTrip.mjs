export class MetroGTFSRTrip {

  #operationDay
  #startTime
  #scheduleRelationship
  #routeID

  static SR_SCHEDULED = 0;
  static SR_ADDED = 1;
  static SR_UNSCHEDULED = 2;
  static SR_CANCELLED = 3;

  constructor(trip) {
    this.#operationDay = trip.start_date
    this.#scheduleRelationship = trip.schedule_relationship
    this.#routeID = trip.route_id.slice(-6, -1)

    let [_, startHour, startMinute] = trip.start_time.match(/^(\d\d):(\d\d)/)
    let finalStartHour = parseInt(startHour)
    this.#startTime = `${finalStartHour > 23 ? '0' + (finalStartHour - 24) : startHour}:${startMinute}`
  }

  getTDN() {}
  getOperationDay() { return this.#operationDay }
  getStartTime() { return this.#startTime }
  getScheduleRelationship() { return this.#scheduleRelationship }
  getRouteID() { return this.#routeID }

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
    this.#tdn = trip.trip_id.match(/_(\w\d{3})_\d*$/)[1]
  }

  static canProcess(trip) {
    return !!trip.trip_id.match(/_\w\d{3}_\d*$/)
  }

  getTDN() { return this.#tdn }

}