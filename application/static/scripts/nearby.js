let lastUpdate = 0
let updateInterval = 5 * 1000 // we're a PT app, not a military missile tracker dammit

function processPosition(position) {
  let now = +new Date()
  if ((now - lastUpdate) < updateInterval) return
  lastUpdate = now

  let {coords} = position;
  let {latitude, longitude} = coords;

  $.ajax({
    method: 'POST',
    data: {
      latitude, longitude
    }
}, (err, status, data) => {
    $('#content').innerHTML = data;
  });
}

function onError(error) {

}

$.ready(() => {
  window.navigator.geolocation.watchPosition(processPosition, onError, {
    enableHighAccuracy: true,
    maximumAge: updateInterval
  });
});
