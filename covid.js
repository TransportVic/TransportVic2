const DatabaseConnection = require('./database/DatabaseConnection')
const config = require('./config.json')
const utils = require('./utils')
const async = require('async')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
let timetables

let text = `8.30pm from Craigieburn
9.30pm from Craigieburn
10:30pm from Craigieburn
11pm from Craigieburn
12.40am from Craigieburn
9.24pm to Craigieburn
10.22pm to Craigieburn
11.22pm to Craigieburn
11.52pm to Craigieburn
8.16pm from Alamein
8.09pm from Belgrave
9.14pm from Alamein
9.19pm from Ringwood
10.09pm from Belgrave
10.14pm from Alamein
10.48pm from Belgrave
10.48pm from Lilydale
11.09pm from Belgrave
11.14pm from Alamein
11.48pm from Lilydale
12.09am from Belgrave
12.14am from Alamein
8.48pm to Camberwell
8.59pm to Alamein
9.05pm to Ringwood
9.21pm to Belgrave
9.56pm to Lilydale
9.34pm to Ringwood
9.59pm to Alamein
10.04pm to Ringwood
10.26pm to Belgrave
10.49pm to Lilydale
10.59pm to Alamein
11.26pm to Belgrave
11.59pm to Alamein
9.01pm from Sunbury
10pm from Sunbury
11pm from Sunbury
11.53pm from Sunbury
12.55am from Sunbury
9.25pm to Sunbury
9.59pm to Sunbury
10.59pm to Sunbury
11.59pm to Sunbury
7.54pm from Dandenong
8.10pm from Pakenham
9.54pm from Cranbourne
9.30pm from Pakenham
10.07pm from Pakenham
10.26pm from Pakenham
10.52pm from Cranbourne
11.30pm from Cranbourne
8.23pm to Cranbourne
9.02pm to Pakenham
10.02pm to Pakenham
10.32pm to Cranbourne
11.09pm to Cranbourne
11.39pm to Pakenham
12.52am to Pakenham
8.52pm from Sandringham
9.32pm from Sandringham
10:12pm from Sandringham
10.52pm from Sandringham
11.12pm from Sandringham
8.16pm to Sandringham
9.33pm to Sandringham
10.13pm to Sandringham
10.33pm to Sandringham
11.33pm to Sandringham
11.53pm to Sandringham
8.05pm from Frankston
8.45pm from Frankston
9.45pm from Frankston
10.25pm from Frankston
10.45pm from Frankston
10.56pm from Frankston
8.33pm to Frankston
9.14pm to Frankston
9.53pm to Frankston
10.45pm to Frankston
11.45pm to Frankston
7.25pm from Mernda
8.41pm from Macleod
8.42pm from Eltham
9.16pm from Mernda
9.42pm from Eltham
10.42pm from Eltham
10.46pm from Macleod
8pm to Mernda
8.19pm to Eltham
9.18pm to Eltham
9.39pm to Mernda
10.12pm to Eltham
10.30pm to Mernda
11.12pm to Eltham
11.42pm to Hurstbridge`.split('\n')

let serviceIDs = text.map(line => {
  let parts = line.split(' ')

  let departureTime = parts[0].replace('.', ':').slice(0, -2)
  let [hour, minute] = departureTime.split(':')
  if (!minute) minute = 0
  else minute = parseInt(minute.replace(/^0/, ''))

  let hour24 = parseInt(hour) + 12
  let baseTime = hour24 * 60 + minute
  let departureTimes = []

  for (let i = -12; i <= 12; i++) {
    departureTimes.push(baseTime + i)
  }

  let stop = parts[2] + ' Railway Station'

  let main = {
    mode: 'metro train',
    'stopTimings.0.departureTimeMinutes': {
      $in: departureTimes
    },
    direction: parts[1] === 'to' ? 'Down' : 'Up'
  }

  if (main.direction === 'Up') main.origin = stop
  else main.destination = stop

  return main
})

database.connect(async err => {
  timetables = database.getCollection('timetables')

  let runIDs = (await async.map(serviceIDs, async query => {
    let timetable = await timetables.findDocument(query)

    if (timetable) return { runID: timetable.runID, days: 'Weekday' }
  })).filter(Boolean)

  console.log(runIDs)
})
