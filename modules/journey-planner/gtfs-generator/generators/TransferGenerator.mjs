import CopyGenerator from './CopyGenerator.mjs'

export default class TransferGenerator extends CopyGenerator {

  #tripsSeen

  constructor(db, tripsSeen, gtfsFolder) {
    super(db, gtfsFolder)
    this.#tripsSeen = tripsSeen
  }

  getHeader() { return 'from_stop_id,to_stop_id,from_route_id,to_route_id,from_trip_id,to_trip_id,transfer_type,min_transfer_time' }
  getFileName() { return 'transfers.txt' }

  processColumn(column, folder, line) {
    const data = line[column]
    if (column === 'from_route_id' || column === 'to_route_id') {
      return data.replace(/aus:vic:vic-0?(\d+-\w+).+/, '$1').replace(/-mjp-\d+/, '')
    }

    return data
  }

  acceptLine(line) {
    return this.#tripsSeen.has(line.from_trip_id) && this.#tripsSeen.has(line.to_trip_id)
  }

}