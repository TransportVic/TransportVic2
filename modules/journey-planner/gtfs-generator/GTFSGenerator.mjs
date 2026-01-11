import AgencyGenerator from './generators/AgencyGenerator.mjs'
import fs from 'fs'
import path from 'path'
import StopGenerator from './generators/StopGenerator.mjs'
import CalendarGenerator from './generators/CalendarGenerator.mjs'
import RouteGenerator from './generators/RouteGenerator.mjs'
import TripGenerator from './generators/TripGenerator.mjs'
import PathwayGenerator from './generators/PathwayGenerator.mjs'
import TransferGenerator from './generators/TransferGenerator.mjs'

export default class GTFSGenerator {

  #db
  #gtfsFolder
  #outputFolder

  constructor(db, gtfsFolder, outputFolder) {
    this.#db = db
    this.#gtfsFolder = gtfsFolder
    this.#outputFolder = outputFolder
  }

  createStreams() {
    return {
      agency: fs.createWriteStream(path.join(this.#outputFolder, 'agency.txt')),
      calendar: fs.createWriteStream(path.join(this.#outputFolder, 'calendar.txt')),
      calendarDates: fs.createWriteStream(path.join(this.#outputFolder, 'calendar_dates.txt')),
      pathways: fs.createWriteStream(path.join(this.#outputFolder, 'pathways.txt')),
      routes: fs.createWriteStream(path.join(this.#outputFolder, 'routes.txt')),
      shapes: fs.createWriteStream(path.join(this.#outputFolder, 'shapes.txt')),
      stopTimes: fs.createWriteStream(path.join(this.#outputFolder, 'stop_times.txt')),
      stops: fs.createWriteStream(path.join(this.#outputFolder, 'stops.txt')),
      trips: fs.createWriteStream(path.join(this.#outputFolder, 'trips.txt')),
      transfers: fs.createWriteStream(path.join(this.#outputFolder, 'transfers.txt'))
    }
  }

  async writeFiles() {
    const streams = this.createStreams()

    const agencyGenerator = new AgencyGenerator(this.#db)
    await agencyGenerator.generateFileContents(streams.agency)

    const stopGenerator = new StopGenerator(this.#db)
    await stopGenerator.generateFileContents(streams.stops)

    const calendarGenerator = new CalendarGenerator(this.#db, this.#gtfsFolder)
    await calendarGenerator.generateFileContents(streams.calendar, streams.calendarDates)

    const routeGenerator = new RouteGenerator(this.#db)
    await routeGenerator.generateFileContents(streams.routes, streams.shapes)
    
    const shapeMapping = routeGenerator.getShapeMapping()
    const tripGenerator = new TripGenerator(this.#db, shapeMapping)
    await tripGenerator.generateFileContents(streams.trips, streams.stopTimes, calendarGenerator)

    // const pathwayGenerator = new PathwayGenerator(this.#db, this.#gtfsFolder)
    // await pathwayGenerator.generateFileContents(streams.pathways)

    const tripsSeen = tripGenerator.getTripsSeen()
    const transferGenerator = new TransferGenerator(this.#db, tripsSeen, this.#gtfsFolder)
    await transferGenerator.generateFileContents(streams.transfers)
  }

}