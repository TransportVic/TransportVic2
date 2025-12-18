import CopyGenerator from './CopyGenerator.mjs'

export default class TransferGenerator extends CopyGenerator {

  getHeader() { return 'from_stop_id,to_stop_id,from_route_id,to_route_id,from_trip_id,to_trip_id,transfer_type,min_transfer_time' }
  getFileName() { return 'transfers.txt' }

}