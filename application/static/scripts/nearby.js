let lastUpdate = 0
let updateInterval = 5 * 1000 // we're a PT app, not a military missile tracker dammit

function processPosition(position) {
  let now = +new Date()
  if ((now - lastUpdate) < updateInterval) return
  lastUpdate = now

  let {coords} = position
  let {latitude, longitude} = coords

  $.ajax({
    method: 'POST',
    data: {
      latitude, longitude
    }
}, (err, status, data) => {
    $('#content').innerHTML = data
  })
}

function onError(error) {
  $('#content').className = 'none'
  let message = ''
  if (error.code === 1) message = "You'll have to accept the prompt for this to work"
  if (error.code === 2) message = "Whoops! Something went wrong and I can't find your location!"
  if (error.code === 3) message = "Whoops! Finding your location took too long!"

  $('#content').innerHTML = `
<h2>${message}</h2>
<img src="/static/images/home/500.svg" />
<div>
  <a href="/">Try going home</a>
  <span>&nbspOr&nbsp</span>
  <a href="/search">Searching for a stop</a>
</div>`
}

$.ready(() => {
  window.navigator.geolocation.watchPosition(processPosition, onError, {
    enableHighAccuracy: true,
    maximumAge: updateInterval
  })
})
