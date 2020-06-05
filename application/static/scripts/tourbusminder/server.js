mapboxgl.accessToken = 'pk.eyJ1IjoidW5pa2l0dHkiLCJhIjoiY2p6bnVvYWJ4MDdlNjNlbWsxMzJwcjh4OSJ9.qhftGWgQBDdGlaz3jVGvUQ';

let nosleep, map

let markers = {}

let url = location.protocol.replace('http', 'ws') + '//' + location.host + '/loc/server'

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


function createBus(bus) {
  let el = document.createElement('div')
  el.className = 'marker'
console.log('creating bus', bus)
  let marker = new mapboxgl.Marker(el)
  let popup = new mapboxgl.Popup({ offset: 25 })
  .setHTML(`<h3> Bus ${bus.rego} </h3><p> ${bus.tripName} </p>`)

  marker.setLngLat(bus.position.coordinates)
    .setPopup(popup)
    .addTo(map)

  markers[bus.rego] = marker
}

let hasInitialised = false

websocket.addEventListener('message', data => {
  let buses = JSON.parse(data.data)

  if (buses.initial) {
    buses.initial.forEach(bus => {
      createBus(bus)
    })
    hasInitialised = true
  } else {
    if (!hasInitialised) return
    if (buses.update) {
      let busData = buses.update
      if (markers[busData.rego]) {
        markers[busData.rego].setLngLat(busData.position.coordinates)
      } else {
        createBus(busData)
      }
    } else if (buses.quit) {
      let busData = buses.quit
      if (markers[busData.rego]) {
        markers[busData.rego].remove()
      }
    }
  }
})

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
  })

})
