const config = require('../../config')

global.gtfsNumber = process.argv[2]
global.preserve = process.argv[3] === 'true'
global.gtfsMode = 'bus'

if (config.gtfsBatcher)
  require('../generic/load-gtfs-timetables-batched')
else
  require('./load-bus-gtfs-timetables-nobatch')
