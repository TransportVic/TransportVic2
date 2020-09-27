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

let colours = {
  'bus': '#D7832C',
  'metro train': '#3483DB',
  'tram': '#1A942A',
  'regional train': '#6B4D9E',
  'regional coach': '#9582B5',
  'ferry': '#03998F',
  'heritage train': '#593915'
}

$.ready(() => {
  $.ajax({
    method: 'POST'
  }, (err, status, data) => {
    let { modeRoutePaths } = data

    let modes = ['bus', 'metro train', 'regional train', 'heritage train', 'tram', 'regional coach', 'ferry']
    modes.forEach(mode => {
      L.geoJSON(modeRoutePaths[mode], {
        style: {
          color: colours[mode],
          weight: 1
        }
      }).addTo(map)
    })
  })
})
