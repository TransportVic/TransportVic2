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

let stopCSSClasses = {
  'bus': 'busStop',
  'metro train': 'metroStation',
  'regional train': 'vlineStation',
  'heritage train': 'heritageStation',
  'regional coach': 'regionalCoachStop',
  'tram': 'tramStop',
  'ferry': 'ferryTerminal'
}

let colours = {
  'bus': '#D7832C',
  'metro train': '#3483DB',
  'tram': '#1A942A',
  'regional train': '#6B4D9E',
  'heritage train': '#593915',
  'regional coach': '#9582B5',
  'ferry': '#03998F',
}

$.ready(() => {
  $.ajax({
    url: '/stop-preview/bays',
    method: 'GET'
  }, (err, status, data) => {
    bayData = data

    $.ajax({
      method: 'POST'
    }, (err, status, data) => {
      let { allRoutePaths, bbox, routeType, stops } = data

      L.geoJSON(allRoutePaths, {
        style: {
          color: colours[routeType]
        }
      }).addTo(map)

      stops.forEach(bay => {
        let coordinates = bay.location.coordinates
        let location = [coordinates[1], coordinates[0]]

        let icon = L.divIcon({className: `stopIcon ${stopCSSClasses[bay.mode]}`})

        let marker = L.marker(location, {icon: icon}).addTo(map)

        let name = bay.fullStopName
        if (bayData[bay.stopGTFSID]) name += ` (${bayData[bay.stopGTFSID]})`
        if (bay.stopNumber) name += ` #${bay.stopNumber}`

        name += `<br>Stop ID: ${bay.stopGTFSID}`
        if (bay.tramTrackerID) {
          name += `<br>TramTracker ID: ${bay.tramTrackerID}`
        }
        if (bay.mykiZones && bay.mykiZones.length) {
          if (bay.mykiZones === 'Paper Ticketed') {
            name += '<br>Paper Ticket'
          } else if (bay.mykiZones.includes(0)) {
            name += `<br>Myki: Free Tram Zone`
          } else {
            name += `<br>Myki: Zone${bay.mykiZones.length > 1 ? 's' : ''} ${bay.mykiZones.join(', ')}`
          }
        }

        marker.bindPopup(name)
      })

      map.fitBounds([bbox.geometry.coordinates[0][0].reverse(), bbox.geometry.coordinates[0][2].reverse()])
    })
  })
})
