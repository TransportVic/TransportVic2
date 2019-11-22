let route = '4-900'
let routeData = {}
let trips = {}
let stops = {}
let stopDistances = {}

function fetchTimetables(cb) {
  $.ajax({
    url: '/transit-visualiser/timetables/' + route
  }, (err, status, data) => {
    routeData = data.routeData
    trips = data.trips
    stops = data.stops
    stopDistances = data.stopDistances
    cb()
  })
}

setInterval(() => {
  fetchTimetables(() => {
    mapTrips()
  })
}, 60000)

mapboxgl.accessToken = 'pk.eyJ1IjoidW5pa2l0dHkiLCJhIjoiY2p6bnVvYWJ4MDdlNjNlbWsxMzJwcjh4OSJ9.qhftGWgQBDdGlaz3jVGvUQ'
let  map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v10',
  zoom: 9,
  center: [145, -38]
})

// turf: lineslice start & stop loc, length

function drawPath() {
  routeData.routePath.forEach(path => {
    map.addLayer({
      id: `shape-path.${path.fullGTFSIDs.join('/')}`,
      type: 'line',
      source: {
        type: 'geojson',
        data: {
          type: 'LineString',
          coordinates: path.path
        }
      },
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
        },
        paint: {
        'line-color': '#ed810e',
        'line-width': 8
        }
    })
  })
}

function setTripMarkers() {
  let now = moment.tz('Australia/Melbourne')
  let millisecondsPastMidnight = now.get('hours') * 3600000 + now.get('minutes') * 60000 + now.get('seconds') * 1000 + now.get('milliseconds')

  let tripMarkers = []
  trips.forEach(trip => {
    let nextStop = trip.stopTimings.find(stop => millisecondsPastMidnight < stop.arrivalTimeMinutes * 60000)
    let shapeData = turf.lineString(routeData.routePath.find(path => path.fullGTFSIDs.includes(trip.shapeID)).path)

    if (!nextStop || nextStop.i === 0) return
    let previousStop = trip.stopTimings[nextStop.i - 1]
    if (!previousStop) console.log(nextStop)
    let timeSinceDeparture = millisecondsPastMidnight - previousStop.departureTimeMinutes * 60000

    let vehicleDistance = previousStop.distance + (nextStop.speed * timeSinceDeparture / 60000)
    if (vehicleDistance < 0) return

    let position = turf.along(shapeData, vehicleDistance, 'kilometers')
    tripMarkers.push(position)
  })

  map.getSource('trips').setData({
    type: 'FeatureCollection',
    features: tripMarkers
  })

  requestAnimationFrame(setTripMarkers)
}

function mapTrips() {
  trips = trips.map(trip => {
    let distanceData = stopDistances[Object.keys(stopDistances).find(k => k === trip.shapeID)]

    trip.stopTimings = trip.stopTimings.map((stop, i, arr) => {
      if (stop.departureTimeMinutes - stop.arrivalTimeMinutes < 0) {
        stop.departureTimeMinutes += 1440
      }

      if (arr[i - 1]) {
        stop.distance = distanceData[stop.stopGTFSID] - distanceData[arr[i - 1].stopGTFSID]
        if (stop.arrivalTimeMinutes - arr[i - 1].departureTimeMinutes < 0) {
          stop.arrivalTimeMinutes += 1440
          stop.departureTimeMinutes += 1440
        }
        stop.dT = stop.arrivalTimeMinutes - arr[i - 1].departureTimeMinutes
        if (stop.dT)
          stop.speed = (stop.distance - arr[i - 1].distance) / stop.dT
        else
          stop.speed = (stop.distance - arr[i - 1].distance) * 2
      } else {
        stop.distance = 0
        stop.dT = 0
        stop.speed = 0
      }
      stop.i = i; return stop
    })
    return trip
  })
}

map.on('load', function () {
  fetchTimetables(() => {
    drawPath()
    mapTrips()

    map.addSource('trips', { type: 'geojson', data: {
      type: 'FeatureCollection',
      features: []
    }})
    map.addLayer({
      id: 'trips',
      type: 'symbol',
      source: 'trips',
      layout: {
        'icon-image': 'rocket-15'
      }
    })

    setTripMarkers()
  })
})
