const config = require('../../config')

global.gtfsNumber = process.argv[2]

if (config.gtfsBatcher)
  require('./load-bus-gtfs-timetables')
else
  require('./load-bus-gtfs-timetables-nobatch')
