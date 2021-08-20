const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config.json')
const utils = require('../utils')
const stopNameModifier = require('../additional-data/stop-name-modifier')
const async = require('async')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)

let stops = {
  'Bulleen': 'bulleen/bulleen-terminus-thompsons-road',
  'Queen & Collins Street': 'melbourne-city/little-collins-street-queen-street',
  'Collins & Queen Street': 'melbourne-city/collins-street-queen-street',
  'Queen Street & Flinders Lane': 'melbourne-city/flinders-lane-queen-street',
  'Somerville & Williamstown Road': 'yarraville/bayview-road-somerville-road',
  'Altona North Park & Ride': 'altona-north/altona-north-park-ride-millers-road',
  'Garden City Bus Interchange': 'port-melbourne/garden-city-centre-avenue',
  'Garden City Interchange': 'port-melbourne/garden-city-centre-avenue',
  'Lorimer Street Extension': 'port-melbourne/sardine-street-lorimer-street',
  'La Trobe University Bus Interchange': 'bundoora/la-trobe-university',
  'Box Hill Central': 'box-hill/box-hill-railway-station',
  'King Street & Lonsdale Street': 'melbourne-city/king-street-lonsdale-street',
  'Westwood Dve & Lexington Dve': 'burnside/lexington-drive-westwood-drive',
  'Lonsdale & Spencer Street': 'melbourne-city/king-street-lonsdale-street',
  'Warrandyte Bridge': 'warrandyte/warrandyte-bridge-yarra-street',
  'Doncaster Park & Ride': 'doncaster/doncaster-park-ride-doncaster-road',
  'Fishermans Bend Wharf Road': 'port-melbourne/fishermans-bend-wharf-road',
  'Clifton Hill Bus Interchange': 'clifton-hill/clifton-hill-interchange-queens-parade',
  'Caroline Springs Town Centre': 'caroline-springs/caroline-springs-library-caroline-springs-boulevard',
  'East Kew Interchange': 'kew-east/east-kew-terminus-valerie-street',
  'Caroline Springs': 'caroline-springs/caroline-springs-square-shopping-centre-main-street'
}

let text = `Route 200 City (Queen St) - Bulleen

Services departing Bulleen - 6.31am, 7.08am, 7.22am, 11.38am, 12.39pm, 2.19pm, 6.54pm

Services departing City Queen & Collins Streets - 7.55am, 11.37am, 1.17pm, 1.55pm, 5.53pm
Route 207 City - Doncaster SC via Kew Junction

Services departing Doncaster Shopping Centre - 10.23am, 11.03am, 12.23pm, 12.43pm, 5.39pm

Services departing CBD Queen & Collins Streets (West Side) - 6.50am, 7.32am, 9.50am, 12.47pm, 3.21pm
Route 215 Caroline Springs - Highpoint SC

Services departing Caroline Springs - 3.40pm, 8:19, 9:19, 10:19, 11:19, 12:19, 13:19, 14:19, 15:20, 16:20, 17:20, 18:20, 19:20, 20:20

Services departing Highpoint Shopping Centre - 8:39, 9:39, 10:39, 11:39, 12:39, 13:39, 14:35, 15:31, 16:31, 17:31, 18:31, 19:25, 20:15, 21:05
Route 216 Sunshine Station - City via Dynon Rd

Services departing City, Queen Street and Flinders Lane - 6.45am, 7.11am, 7.38am, 8.15am, 9.15am, 10.30am, 12.30pm, 1.00pm, 1.30pm, 1.45pm, 2.15pm, 2.45pm, 4.31pm, 4.40pm, 5.26pm, 7.37pm, 8.20pm, 8.35pm, 9.35pm, 11.30pm, 8:40, 9:10, 9:40, 10:10, 10:40, 11:10, 11:40, 12:10, 12:40, 13:10, 13:37, 14:07, 14:34, 15:04, 15:34, 16:04, 16:29, 16:59, 17:34, 18:04, 18:40, 19:15, 19:45, 20:15, 20:45, 21:15, 21:45, 22:15, 22:45, 23:15

Services departing Sunshine Railway Station - 6.25am, 6.49am, 7.17am, 7.49am, 8.40am, 9.10am, 9.33am, 10.03am, 10.48am, 3.33pm, 4.03pm, 4.33pm, 5.33pm, 6.33pm, 7.03pm, 7.48pm, 9.20pm,  7:30, 8:00, 8:30, 9:00, 9:30, 10:00, 10:30, 11:00, 11:30, 12:00, 12:30, 13:00, 13:30, 14:00, 14:30, 15:00, 15:30, 16:00, 16:30, 17:00, 17:30, 18:00, 18:30, 19:00, 19:30, 20:00, 20:30, 21:00, 21:30, 22:00, 22:30, 23:00
Route 220 Sunshine Station - City via Footscray Rd

Services departing City, Queen Street and Flinders Lane - 7.10am, 7.40am, 8.27am, 9.10am, 9.40am, 10.10am, 10.25am, 10.55am, 11.40am, 3.25pm, 4.25pm, 5.05pm, 5.25pm, 5.35pm, 5.55pm, 6.29pm, 7.20pm, 7.47pm, 8.32pm, 10.02pm, 9:05, 9:35, 10:02, 10:32, 11:02, 11:32, 12:02, 12:32, 13:02, 13:32, 14:02, 14:32, 15:02, 15:32, 16:08, 16:38, 17:10, 17:40, 18:07, 18:37, 19:06, 19:36, 20:07, 20:37, 21:02, 21:32, 22:07, 22:37, 23:02, 23:32

Services departing Sunshine Station - 5.50am, 6.20am, 6.44am, 7.10am, 7.27am, 7.56am, 8.04am, 8.28am, 9.28am, 11.28am, 11.58am, 12.28pm, 12.43pm, 1.13pm, 1.43pm, 3.13pm, 4.13pm, 4.43pm, 6.43pm, 7.28pm, 7.43pm, 8.45pm, 9.25pm, 10.45pm, 7:57, 8:27, 9:00, 9:30, 10:02, 10:32, 11:00, 11:30, 12:00, 12:30, 13:00, 13:30, 14:00, 14:30, 15:00, 15:30, 16:00, 16:30, 17:00, 17:30, 18:13, 18:43, 19:05, 19:35, 20:00, 20:30, 21:05, 21:35, 22:00, 22:30, 23:05, 23:35
Route 223 Yarraville - Highpoint SC

Services departing Highpoint Shopping Centre - 9.00am, 9.45am, 10.45am, 1.15pm, 2.30pm, 2.45pm, 3.15pm, 3.45pm, 4.45pm, 5.45pm, 6.30pm, 6.45pm, 7.40pm, 8.40pm, 9.40pm, 10.40pm, 11.40pm,  8:22, 8:52, 9:21, 9:50, 10:20, 10:50, 11:20, 11:50, 12:20, 12:50, 13:21, 13:51, 14:21, 14:52, 15:22, 15:52, 16:23, 16:53, 17:24, 17:53, 18:23, 18:49, 19:17, 19:46, 20:16, 20:46, 21:16, 21:46, 22:16, 22:44, 23:14, 23:44, 00:14

Services departing Somerville & Williamstown Rds - 8.31am, 9.17am, 10.15am, 1.45pm, 2.45pm, 3.15pm, 3.46pm, 4.15pm, 5.15pm, 5.46pm, 6.17pm, 7.00pm, 7.15pm, 8.10pm, 9.03pm, 10.04pm, 11.04pm
Route 232 Altona North - City (Queen Victoria Market)

Services departing Altona North Park & Ride - 6.30am, 7.48am, 8.25am, 9.18am, 10.15am, 11.35am, 12.35pm, 12.55pm, 2.15pm, 2.35pm, 3.15pm, 3.55pm, 4.35pm, 5.35pm, 6.25pm, 8:39, 9:37, 10:34, 11:34, 12:35, 13:35, 14:35, 15:38, 16:45, 17:56, 18:44, 19:34, 20:40

Services departing Queen Victoria Market - 7.10am, 8.35am, 9.35am, 10.55am, 11.55am, 12.15pm, 1.35pm, 1.55pm, 2.35pm, 3.15pm, 3.35pm, 4.10pm, 4.40pm, 5.10pm, 5.20pm, 6.25pm, 7.10pm, 7:50, 8:50, 9:50, 10:50, 11:50, 12:50, 13:50, 14:50, 15:50, 16:50, 17:50, 18:50, 19:50, 20:20, 21:36
Route 234 Garden City - City (Queen Victoria Market)

Services departing Garden City Bus Interchange - 5.50am, 7.55am, 8.25am, 10.00am, 1.00pm, 2.45pm, 3.30pm, 4.00pm

Services departing Queen Victoria Market - 7.30am, 9.30am, 10.00am, 10.30am, 1.00pm, 4.00pm, 4.30pm, 5.00pm
Route 235 City - Fishermans Bend via Williamstown Road

Services departing Fishermans Bend (Wharf Rd) - 6.56am, 8.56am, 9.16am, 10.16am, 10.36am, 11.36am, 12.16pm, 1.56pm, 2.16pm, 3.16pm, 3.46pm, 4.11pm, 5.20pm

Services departing Queen Victoria Market - 6.23am, 7.05am, 9.38am, 9.58am, 10.58am, 11.38am, 1.18pm, 1.38pm, 2.38pm, 2.58pm, 4.38pm

Services departing Southern Cross Station - 7.38am, 8.05am, 8.23am
Route 236 Garden City - Queen Victoria Market via City

Services departing Garden City Interchange - 6.55am, 11.05am, 11.45am, 12.25pm

Services departing Queen Victoria Market - 7.30am, 11.50am, 12.25pm
Route 237 City - Fishermans Bend via Lorimer Street

Services departing Lorimer St Extension - 7.32am, 8.50am, 12.47pm, 4.32pm, 4.52pm, 5.42pm, 5.56pm

Services departing Queen Victoria Market - 8.05am, 12.15pm, 3.55pm, 5.12pm

Services departing Southern Cross Station - 7.08am
Route 246 Clifton Hill - Elsternwick

Services departing Clifton Hill Bus Interchange - 6.31am, 7.19am, 7.47am, 8.24am, 9.56am, 10.30am, 10.50am, 12.10pm, 12.30pm, 12.50pm, 2.08pm, 2.28pm, 2.48pm, 3.29pm, 4.10pm, 4.30pm, 4.50pm, 5.34pm, 6.15pm, 8.10pm

Services departing Elsternwick Railway Station - 7.15am, 8.19am, 8.56am, 9.30am, 10.51am, 11.21am, 11.41am, 1.01pm, 1.21pm, 1.41pm, 3.00pm, 3.22pm, 3.44pm, 4.27pm, 5.07pm, 5.27pm, 5.51pm, 6.41pm, 7.18pm, 9.00pm
Route 250 City (Queen St) - La Trobe University

Services departing La Trobe University Bus Interchange - 5.52am, 7.28am, 8.30am, 9.38am, 7.53pm, 10.05pm

Services departing City Queen & Collins Streets - 6.24am, 5.40pm, 9.00pm, 11.00pm
Route 251 City (Queen St) - Northland SC

Services departing Northland SC - 6.53am
Route 270 Box Hill - Mitcham via Blackburn North

Services departing Box Hill Central - 4.55pm

Services Mitcham Railway Station - 5.40pm
Route 279 Box Hill - Doncaster SC via Middleborough Rd

Services departing Box Hill Central - 5.05pm

Services departing Doncaster Shopping Centre - 3.37pm
Route 302 City - Box Hill Station

Services departing Box Hill Central - 6.35am, 7.26am, 8.30am, 10.05am, 11.35am, 6.16pm, 8.15pm

Services departing East Kew Interchange - 6.05am

Services departing City King Street & Lonsdale Street - 7.32am, 10.38am, 11.07am, 12.37pm, 3.55pm, 7.17pm
Route 304 City - Doncaster SC

Services departing Doncaster Shopping Centre - 7.32am, 8.55am

Services departing City King Street & Lonsdale Street - 8.04am, 6.16pm
Route 305 The Pines SC via Eastern Fwy

Services departing Doncaster Shopping Centre - 7.54am, 11.09am, 11.55am

Services departing The Pines Shopping Centre - 6.55am, 8.19am, 10.48am, 11.33am, 12.18pm, 1.03pm, 3.15pm
Route 309 City - Donvale

Services departing Collins & Queen St - 12.10pm, 2.10pm
Route 350 City - La Trobe University

Services departing La Trobe University Bus Interchange - 7.51am, 9.28am, 4.32pm

Services departing Queen & Collins Sts - 7.26am, 8.26am, 9.07am, 3.24pm
Route 426 Caroline Springs - Sunshine Station

Services departing Caroline Springs - 12.52pm, 2.12pm, 3.50pm, 5.20pm, 8.20pm, 7:58, 8:40, 9:20, 10:00, 10:40, 11:20, 12:00, 12:40, 13:20, 14:00, 14:40, 15:20, 16:00, 16:41, 17:22, 18:02, 18:40, 19:20, 20:00, 20:40, 21:20, 22:00, 22:56

Services departing Sunshine Station - 12.16pm, 1.36pm, 5.42pm, 10.55pm, 8:00, 8:40, 9:22, 10:00, 10:40, 11:20, 12:00, 12:40, 13:20, 14:00, 14:40, 15:20, 16:00, 16:40, 17:20, 18:00, 18:40, 19:20, 20:00, 20:40, 21:20, 22:00, 22:40, 23:25, 24:25

Services departing Westwood Dve & Lexington Dve - 7.19am
Route 429 Sunshine Station - Sunshine South Loop

Route 429 services will not run today.
Route 903 Altona - Mordialloc

Route 903 services will operate to a Saturday timetable today. Click here to view the timetable.
Route 905 City - The Pines SC via Eastern Fwy & Templestowe

Services departing Lonsdale & Spencer Sts - 6.23am, 9.35am, 10.20am, 11.35am, 11.50am, 12.20pm, 1.35pm, 2.20pm, 4.32pm

Services departing The Pines Shopping Centre - 6.49am, 7.09am, 10.30am, 10.45am, 11.15am, 12.32pm, 1.18pm, 2.33pm, 3.18pm
Route 906 City - Warrandyte

Services departing City Lonsdale & Spencer Sts - 5.35am, 4.26pm, 7.25pm

Services departing Warrandyte Bridge - 6.49am, 6.59am, 7.04am, 1.15pm, 8.30pm
Route 907 City - Mitcham via Doncaster Rd

Services departing City Lonsdale & Spencer Sts - 6.45am, 3.34pm

Services departing Mitcham Station - 7.41am, 6.18pm
Route 908 City - The Pines SC via Eastern Fwy

Services departing Doncaster Park & Ride - 6.15am

Services departing Lonsdale & Spencer Sts - 4.23pm, 4.31pm

Services departing The Pines Shopping Centre - 5.30am, 5.40pm, 5.55pm`.split('\n').filter(Boolean)

let currentService = ''
let today = utils.getYYYYMMDDNow()

database.connect(async err => {
  let gtfsTimetables = database.getCollection('gtfs timetables')
  let dbStops = database.getCollection('stops')
  let covid19Cancelled = database.getCollection('covid19 cancellations')

  let serviceQueries = await async.mapSeries(text, async line => {
    let base = {
      mode: 'bus',
      operationDays: today,
      routeNumber: currentService
    }

    if (line.startsWith('Route')) {
      currentService = line.slice(6, 9)
      if (line.includes('will not run')) {
        return base
      } else return
    } else if (line.includes('operate to')) {
      return null
    } else {
      let rawOrigin = line.slice(9, line.indexOf('-') - 1).replace('departing', '').trim()
      let cleanedUp = rawOrigin.replace(/^City/, '').replace('CBD', '').replace(' and ', ' & ')
        .replace('Streets', 'Street').replace('West Side', '')
        .replace('Sts', 'Street').replace('Rds', 'Road').replace(/[,\(\)]/g, '').trim()

      let origin = stopNameModifier(utils.adjustStopName(cleanedUp))
      let stop

      if (stops[origin]) {
        let parts = stops[origin].split('/')
        stop = await dbStops.findDocument({
          codedName: parts[1],
          codedSuburb: parts[0]
        })
      } else {
        stop = await dbStops.findDocument({
          stopName: new RegExp(origin)
        })
      }

      let times = line.slice(line.indexOf('-') + 2).trim().split(', ').map(time => {
        if (time.includes(':')) {
          if (time.startsWith('24')) return '00' + time.slice(2)
          else return utils.pad(time, 5)
        }
        let dot = time.indexOf('.')
        let hour = time.slice(0, dot)
        let min = time.slice(dot + 1, dot + 3)
        let apm = time.slice(-2)

        if (apm === 'am' || hour === '12') {
          return utils.pad(hour, 2) + ':' + utils.pad(min, 2)
        } else {
          return utils.pad(parseInt(hour) + 12, 2) + ':' + utils.pad(min, 2)
        }
      })

      return {
        ...base,
        'stopTimings.0.stopGTFSID': {
          $in: stop.bays.map(stop => stop.stopGTFSID)
        },
        departureTime: {
          $in: times
        }
      }
    }
  })

  let cancelledTrips = []

  await async.forEach(serviceQueries.filter(Boolean), async query => {
    let timetables = await gtfsTimetables.findDocuments(query).toArray()
    cancelledTrips.push(...timetables.map(trip => ({
      mode: 'bus',
      date: today,
      routeGTFSID: trip.routeGTFSID,
      routeNumber: trip.routeNumber,
      origin: trip.origin,
      destination: trip.destination,
      departureTime: trip.departureTime,
      destinationArrivalTime: trip.destinationArrivalTime
    })))
  })

  await covid19Cancelled.deleteDocuments({ mode: 'bus', date: today })
  await covid19Cancelled.createDocuments(cancelledTrips)

  process.exit(0)
})
