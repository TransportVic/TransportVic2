const ATTRIBUTION_MAPBOX = '© <a href="https://www.mapbox.com/feedback/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
const ATTRIBUTION = '<a id="home-link" target="_top" href="maps.stamen.com">Map tiles</a> by <a target="_top" href="http://stamen.com">Stamen Design</a>, under <a target="_top" href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a target="_top" href="http://openstreetmap.org">OpenStreetMap</a>, under <a target="_top" href="http://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>.'
const MAPBOX_TOKEN = 'pk.eyJ1IjoidW5pa2l0dHkiLCJhIjoiY2p6bnVvYWJ4MDdlNjNlbWsxMzJwcjh4OSJ9.qhftGWgQBDdGlaz3jVGvUQ'

let map = L.map('map').setView([-38, 145], 9)
L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/streets-v11/tiles/{z}/{x}/{y}?access_token=' + MAPBOX_TOKEN, {
    attribution: ATTRIBUTION_MAPBOX,
    maxZoom: 19,
    minZoom: 2,
    id: 'mapbox'
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

$.ajax({
  url: '/static/misc/track-centreline-named.json',
  method: 'GET'
}, (err, status, data) => {
  L.geoJSON(data.features, {
    style: () => ({color: `#${Math.floor(Math.random()*255*255*255).toString(16)}`}),
    onEachFeature: (feature, layer) => {
      layer.on('click', function (e) {
        layer.bindPopup(JSON.stringify(feature.properties, null, 2))
        this.openPopup()
      })
    }
  }).addTo(map)
})
