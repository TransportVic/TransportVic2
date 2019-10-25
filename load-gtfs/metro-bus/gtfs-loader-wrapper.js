const config = require('../../config')

if (config.gtfsBatcher)
  require('./load-bus-gtfs-timetables')
else
  require('./load-bus-gtfs-timetables-nobatch')
