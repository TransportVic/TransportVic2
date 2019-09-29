mapboxgl.accessToken = 'pk.eyJ1IjoidW5pa2l0dHkiLCJhIjoiY2p6bnVvYWJ4MDdlNjNlbWsxMzJwcjh4OSJ9.qhftGWgQBDdGlaz3jVGvUQ';
var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11',
  zoom: 9,
  center: [145, -38]
});

map.on('load', function () {
  $('#update').on('click', () => {
    map.addLayer({
      id: 'input-' + +new Date(),
      type: 'line',
      source: {
        type: 'geojson',
        data: JSON.parse($('#content').value)
      }
    })
  })
});
