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

let currentMarker
let hasShownError = false
let currentRouteGTFSID = null
let currentLayer = null

function loadRoutePath(routeGTFSID) {
  if (routeGTFSID !== currentRouteGTFSID) {
    $.ajax({
      url: `/bus/tracker/locator/shape/${routeGTFSID}`,
      method: 'POST'
    }, (err, status, data) => {
      if (currentLayer) map.removeLayer(currentLayer)
      
      currentLayer = L.geoJSON({
        type: 'FeatureCollection',
        features: data.map(points => ({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: points
          }
        }))
      }, {
        style: {
          color: '#D7832C'
        }
      }).addTo(map)
    })

    currentRouteGTFSID = routeGTFSID
  }
}

function updateBody(firstTime) {
  $.ajax({
    method: 'POST'
  }, (err, status, data) => {
    if (data.error) {
      if (currentMarker) {
        currentMarker.remove()
        currentMarker = null
      }

      if (!hasShownError) {
        alert(data.error)
        hasShownError = true
      }
    } else {
      let location = [data.lat, data.lng]

      let icon = L.divIcon({className: 'bus'})
      if (!currentMarker)
        currentMarker = L.marker(location, {icon: icon}).addTo(map)
      else
        currentMarker.setLatLng(location)

      if (firstTime)
        map.setView(location, 18)
      else
        map.setView(location)

      currentMarker.bindPopup(`Bus ${data.fleetNumber}<br>
Currently running:<br>
${data.departureTime} ${data.routeNumber} to ${data.destination}
`)
      hasShownError = false
      loadRoutePath(data.routeGTFSID)
    }
  })
}

$.ready(() => {
  updateBody(true)
  setInterval(updateBody, 1000 * 35)
})
