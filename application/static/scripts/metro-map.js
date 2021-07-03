const ATTRIBUTION = '<a id="home-link" target="_top" href="maps.stamen.com">Map tiles</a> by <a target="_top" href="http://stamen.com">Stamen Design</a>, under <a target="_top" href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a target="_top" href="http://openstreetmap.org">OpenStreetMap</a>, under <a target="_top" href="http://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>.'
let accessToken = 'pk.eyJ1IjoidW5pa2l0dHkiLCJhIjoiY2p6bnVvYWJ4MDdlNjNlbWsxMzJwcjh4OSJ9.qhftGWgQBDdGlaz3jVGvUQ'

let map = L.map('map').setView([-38, 145], 9)

L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
  attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
  maxZoom: 20,
  id: 'mapbox/dark-v10',
  tileSize: 512,
  zoomOffset: -1,
  accessToken
}).addTo(map)

L.control.scale().addTo(map)

let baseIconHTML = `
<div class='train'>
  <div class='trainArrowWrapper' style='transform: rotate({0}deg)'>
    <div class='trainArrow'></div>
  </div>
  <div class='trainData {1}'>
    {2}
  </div>
</div>`

function generateName(train) {
  return `Run ${train.runID}
  <br>Dest: ${train.destination}
  <br>Next: ${train.nextStop.stopName.slice(0, -16)} Plat. ${train.nextStop.platform}
  <br>Type: ${train.vehicle}`
}

function createIcon(train) {
  return L.divIcon({
    html: baseIconHTML.replace('{0}', train.bearing)
      .replace('{1}', train.line)
      .replace('{2}', train.destinationCode)
  })
}

function createMarker(train) {
  if (!train.location) return

  let icon = createIcon(train)
  let marker = L.marker([ train.location.coordinates[1], train.location.coordinates[0] ], {
    icon
  }).addTo(map)

  markers[train.runID] = marker
  marker.bindPopup(generateName(train))
}

let markers = {}

function updateBody() {
  $.ajax({
    method: 'POST'
  }, (err, status, data) => {
    let seen = data.map(train => train.runID)
    Object.keys(markers).forEach(runID => {
      if (!seen.includes(runID)) {
        markers[runID].remove()
        delete markers[runID]
      }
    })

    data.forEach(train => {
      if (markers[train.runID]) {
        let marker = markers[train.runID]
        marker.setLatLng([ train.location.coordinates[1], train.location.coordinates[0] ])
        marker.setIcon(createIcon(train))
        marker.bindPopup(generateName(train))
      } else {
        createMarker(train)
      }
    })
  })
}

$.ready(() => {
  updateBody()
  setInterval(updateBody, 1000 * 10)
})
