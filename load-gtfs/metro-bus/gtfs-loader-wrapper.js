const config = require('../../config')

global.gtfsNumber = process.argv[2]
global.preserve = process.argv[3] === 'true'

if (config.gtfsBatcher)
  require('./load-bus-gtfs-timetables')
else
  require('./load-bus-gtfs-timetables-nobatch')
