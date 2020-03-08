mapboxgl.accessToken = 'pk.eyJ1IjoidW5pa2l0dHkiLCJhIjoiY2p6bnVvYWJ4MDdlNjNlbWsxMzJwcjh4OSJ9.qhftGWgQBDdGlaz3jVGvUQ';

let nosleep, map

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

function positionWatcher(position) {
  let {coords} = position
  let coordinates = [coords.longitude, coords.latitude]
  let timestamp = position.timestamp

  map.getSource('point').setData({
    type: 'Point',
    coordinates
  })

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
