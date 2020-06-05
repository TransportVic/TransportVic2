mapboxgl.accessToken = 'pk.eyJ1IjoidW5pa2l0dHkiLCJhIjoiY2p6bnVvYWJ4MDdlNjNlbWsxMzJwcjh4OSJ9.qhftGWgQBDdGlaz3jVGvUQ';

let nosleep, map

let rego, tripName

function focusMapAt(position, duration) {
  let {coords} = position
  let easeTo = {
    center: [coords.longitude, coords.latitude],
    zoom: 17,
    duration,
  }

  if (coords.heading)
    easeTo.bearing = coords.heading

  map.easeTo(easeTo)
}

let url = location.protocol.replace('http', 'ws') + '//' + location.host + '/loc/client'

let lastTimestamp = 0
let websocket = new WebSocket(url)

function recreate() {
  websocket = null
  setTimeout(() => {
    try {
      websocket = new WebSocket(url)

      websocket.onclose = recreate
    } catch (e) {
      recreate()
    }
  }, 5000)
}

websocket.onclose = recreate

function positionWatcher(position) {
  let {coords} = position
  let coordinates = [coords.longitude, coords.latitude]
  let timestamp = position.timestamp

  map.getSource('point').setData({
    type: 'Point',
    coordinates
  })

  let timeDiff = timestamp - lastTimestamp
  if (timeDiff > 500) { // should really be websockets
    websocket.send(JSON.stringify({
      rego,
      tripName,
      position: {
        type: 'Point',
        coordinates
      }
    }))
  }

  lastTimestamp = timestamp

  focusMapAt(position, 250)
}

function setupLayer(position) {
  let {coords} = position
  map.addSource('point', {
    type: 'geojson',
    data: {
      type: 'Point',
      coordinates: [coords.longitude, coords.latitude]
    }
  })

  map.addLayer({
    id: 'point',
    source: 'point',
    type: 'circle',
    paint: {
      'circle-radius': 5,
      'circle-color': '#007cbf'
    }
  })

  focusMapAt(position, 1000)
}

function enableNoSleep() {
  $('img#nosleep-icon').className = 'enabled'
  nosleep.enable()
}

function disableNoSleep() {
  $('img#nosleep-icon').className = ''
  nosleep.disable()
}

$.ready(() => {
  nosleep = new NoSleep()
  let nosleepEnabled = false

  rego = window.search.query.rego
  tripName = window.search.query.tripName

  $('img#nosleep-icon').on('click', () => {
    if (nosleepEnabled = !nosleepEnabled) enableNoSleep()
    else disableNoSleep()
  })

  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    zoom: 9,
    center: [145, -38]
  })

  map.on('load', function () {
    let options = {
      timeout: 5000,
      maximumAge: 0
    }

    navigator.geolocation.getCurrentPosition(position => {
      setupLayer(position)

      setTimeout(() => {
        navigator.geolocation.watchPosition(positionWatcher, () => {}, {
          enableHighAccuracy: true,
          ...options
        })
      }, 1000)
    }, () => {}, {
      enableHighAccuracy: false,
      ...options
    })
  })

})
