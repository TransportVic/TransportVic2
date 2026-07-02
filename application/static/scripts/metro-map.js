let map = L.map('map').setView([-38, 145], 9)

 L.maplibreGL({
    style: 'https://tiles.openfreemap.org/styles/liberty',
    attribution: 'OpenFreeMap; Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    maxZoom: 20,
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
  <br>Consist: ${train.vehicle}`
}

function createIcon(train) {
  return L.divIcon({
    html: baseIconHTML.replace('{0}', train.bearing)
      .replace('{1}', train.line)
      .replace('{2}', train.runID)
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
