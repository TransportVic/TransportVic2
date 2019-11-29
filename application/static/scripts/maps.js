const ATTRIBUTION = '<a id="home-link" target="_top" href="maps.stamen.com">Map tiles</a> by <a target="_top" href="http://stamen.com">Stamen Design</a>, under <a target="_top" href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a target="_top" href="http://openstreetmap.org">OpenStreetMap</a>, under <a target="_top" href="http://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>.'

let map = L.map('map').setView([-38, 145], 9)
L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.jpg', {
    attribution: ATTRIBUTION,
    maxZoom: 17,
    minZoom: 2,
    id: 'watercolor'
}).addTo(map)

L.tileLayer('https://stamen-tiles-{s}.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}.png', {
    attribution: ATTRIBUTION,
    maxZoom: 17,
    minZoom: 2,
    id: 'toner labels'
}).addTo(map)

L.control.scale().addTo(map)
