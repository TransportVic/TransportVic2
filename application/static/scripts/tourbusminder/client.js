mapboxgl.accessToken = 'pk.eyJ1IjoidW5pa2l0dHkiLCJhIjoiY2p6bnVvYWJ4MDdlNjNlbWsxMzJwcjh4OSJ9.qhftGWgQBDdGlaz3jVGvUQ';

let nosleep, map

function focusMapAt(position, duration) {
  let {coords} = position
  map.flyTo({
    center: [coords.longitude, coords.latitude],
    zoom: 17,
    duration
  })
}

function positionWatcher(position) {
  let {coords} = position
  map.getSource('point').setData({
    type: 'Point',
    coordinates: [coords.longitude, coords.latitude]
  })
  focusMapAt(position, 100)
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

$.ready(() => {
  nosleep = new NoSleep()
  let nosleepEnabled = false
  let nosleepIcon = $('img#nosleep-icon')

  nosleepIcon.on('click', () => {
    nosleepEnabled = !nosleepEnabled
    if (nosleepEnabled) {
      nosleepIcon.className = ''
      nosleep.enable()
    } else {
      nosleepIcon.className = 'enabled'
      nosleep.disable()
    }
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
