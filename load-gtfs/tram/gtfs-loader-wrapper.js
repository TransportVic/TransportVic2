const config = require('../../config')

global.gtfsNumber = 3
global.preserve = false
global.gtfsMode = 'tram'

if (config.gtfsBatcher)
  require('../generic/load-tram-gtfs-timetables-batched')
else
  require('./load-tram-gtfs-timetables-nobatch')
