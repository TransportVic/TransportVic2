const config = require('../../config')

if (config.gtfsBatcher)
  require('./load-metro-bus-gtfs-timetables')
else
  require('./load-metro-bus-gtfs-timetables-nobatch')
