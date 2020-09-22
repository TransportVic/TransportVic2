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

// L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.jpg', {
//     attribution: ATTRIBUTION,
//     maxZoom: 17,
//     minZoom: 2,
//     id: 'watercolor'
// }).addTo(map)
//
// L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}.png', {
//     attribution: ATTRIBUTION,
//     maxZoom: 17,
//     minZoom: 2,
//     id: 'toner labels'
// }).addTo(map)

L.control.scale().addTo(map)

let stopCSSClasses = {
  'bus': 'busStop',
  'metro train': 'metroStation',
  'regional train': 'vlineStation',
  'regional coach': 'regionalCoachStop',
  'tram': 'tramStop',
  'ferry': 'ferryTerminal'
}

let bayData
$.ready(() => {
  $.ajax({
    url: '/stop-preview/bays',
    method: 'GET'
  }, (err, status, data) => {
    bayData = data

    $.ajax({
      method: 'POST'
    }, (err, status, stopData) => {
      stopData.bays.forEach(bay => {
        let coordinates = bay.location.coordinates
        let location = [coordinates[1], coordinates[0]]

        let icon = L.divIcon({className: `stopIcon ${stopCSSClasses[bay.mode]}`})

        let marker = L.marker(location, {icon: icon}).addTo(map)

        let name = bay.fullStopName
        if (bayData[bay.stopGTFSID]) name += ` (${bayData[bay.stopGTFSID]})`
        if (bay.screenServices) {
          name += `<br>Services: ${bay.screenServices.map(e => e.routeNumber).filter((e, i, a) => a.indexOf(e) === i).filter(Boolean).join(', ')}`
        }
        name += `<br>Stop ID: ${bay.stopGTFSID}`
        if (bay.tramTrackerID) {
          name += `<br>TramTracker ID: ${bay.tramTrackerID}`
        }

        marker.bindPopup(name)
      })

      if (stopData.trainReplacementBays) {
        stopData.trainReplacementBays.forEach(bay => {
          let coordinates = bay.location.coordinates
          let location = [coordinates[1], coordinates[0]]

          let icon = L.divIcon({className: 'stopIcon busReplacementBay'})

          let marker = L.marker(location, {icon: icon}).addTo(map)

          let name = `${stopData.stationName} Train Replacement Stop`
          if (bay.bayDesignation) name += ` (${bay.bayDesignation})`
          name += `<br>
Towards: ${bay.towards}`

          marker.bindPopup(name)
        })
      }

      if (stopData.platformGeometry) {
        stopData.platformGeometry.forEach(platform => {
          let {platformNumber, geometry} = platform

          L.geoJSON({
            type: 'Feature',
            geometry
          }).addTo(map).bindPopup('Platform ' + platformNumber)
        })
      }

      let {bbox} = stopData
      map.fitBounds([bbox.geometry.coordinates[0][0].reverse(), bbox.geometry.coordinates[0][2].reverse()])
    })
  })
})
