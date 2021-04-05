function shorternName(name) {
  if (name.includes('North ')) return name.replace('North ', 'Nth ')
  if (name.includes('South ')) return name.replace('South ', 'Sth ')
  if (name === 'Melbourne Central') return 'Melb Central'
  if (name === 'Southern Cross') return 'Spencer Street'
  if (name === 'Upper Ferntree Gully') return 'Upper FT Gully'
  if (name === 'Nar Nar Goon') return 'Nar-Nar-Goon'
  if (name === 'Flemington Racecourse') return 'Flemington Races'

  return name
}

function formatTime(time) {
  let hours = time.getHours()
  let minutes = time.getMinutes()
  let mainTime = ''

  mainTime += (hours % 12) || 12
  mainTime += ':'
  if (minutes < 10) mainTime += '0'
  mainTime += minutes

  return mainTime
}


function setListenAnnouncements() {

}

function updateBody() {
  $.ajax({
    method: 'POST'
  }, (err, status, body) => {
    if (err) return setListenAnnouncements()

    try {
      departures = body.dep

      let firstDeparture = departures[0]
      if (!firstDeparture) return setListenAnnouncements()

      let destination = firstDeparture.dest.toUpperCase()
      if (firstDeparture.route === 'City Circle') destination = 'CITY CIRCLE'
      if (destination === 'SOUTHERN CROSS') destination = 'SPENCER ST'
      if (destination === 'FLINDERS STREET') destination = 'FLINDERS ST'
      if (destination === 'UPPER FERNTREE GULLY') destination = 'UPPER FT GULLY'
      if (destination === 'NORTH MELBOURNE') destination = 'NTH MELBOURNE'
      if (destination === 'FLEMINGTON RACECOURSE') destination = 'FLEMINGTON RACES'
      if (destination === 'SOUTH GEELONG') destination = 'STH GEELONG'
      if (destination === 'SYDNEY CENTRAL') destination = 'SYDNEY XPT'

      $('.destination span').textContent = destination
      $('.departureInfo .scheduledDepartureTime').textContent = formatTime(new Date(firstDeparture.sch))

      if (firstDeparture.est) {
        let minutesToDeparture = rawMinutesToDeparture(new Date(firstDeparture.est))
        if (minutesToDeparture > 0) {
          $('.departureInfo .departingMinutes').textContent = minutesToDeparture
          $('.min').textContent = 'MIN'
        } else {
          $('.departureInfo .departingMinutes').textContent = 'NOW'
          $('.min').textContent = ''
        }
      } else {
        $('.departureInfo .departingMinutes').textContent = '-- '
        $('.min').textContent = 'MIN'
      }

      let stops = firstDeparture.stops.slice(1)

      if (['Traralgon', 'Bairnsdale'].includes(firstDeparture.route)) {
        let nngIndex = stops.findIndex(stop => stop[0] === 'Nar Nar Goon')

        if (nngIndex > 0) {
          stops = stops.slice(nngIndex)
        }
      }

      function getHTML(stops) {
        return stops.map(stop => `<span>${stop[1] ? '- - -' : shorternName(stop[0]).toUpperCase()}</span>`).join('')
      }

      if (stops.length > 16) {
        let firstLeft = stops.slice(0, 8)
        let firstRight = stops.slice(8, 16)

        let remaining = stops.slice(16)
        let leftSize = remaining.length > 10 ? Math.ceil(remaining.length / 2) : 8
        let secondLeft = remaining.slice(0, leftSize)
        let secondRight = remaining.slice(leftSize)

        $('.leftCRT .stops .left').innerHTML = getHTML(firstLeft)
        $('.leftCRT .stops .right').innerHTML = getHTML(firstRight)

        $('.rightCRT .stops .left').innerHTML = getHTML(secondLeft)
        $('.rightCRT .stops .right').innerHTML = getHTML(secondRight)
      } else if (stops.length > 12) {
        let leftSize = Math.ceil(stops.length / 2)

        let firstLeft = stops.slice(0, leftSize)
        let firstRight = stops.slice(leftSize)
        $('.leftCRT .stops .left').innerHTML = getHTML(firstLeft)
        $('.leftCRT .stops .right').innerHTML = getHTML(firstRight)
      } else {
        let firstLeft = stops.slice(0, 8)
        let firstRight = stops.slice(8)
        $('.leftCRT .stops .left').innerHTML = getHTML(firstLeft)
        $('.leftCRT .stops .right').innerHTML = getHTML(firstRight)
      }

      let secondDeparture
      if (secondDeparture = departures[1]) {
        $('.nextDeparture .scheduledDepartureTime').textContent = formatTime(new Date(secondDeparture.sch))
        $('.nextDeparture .destination').textContent = shorternName(secondDeparture.dest).toUpperCase()

        if (secondDeparture.est) {
          let minutesToDeparture = rawMinutesToDeparture(new Date(secondDeparture.est))
          if (minutesToDeparture > 0) {
            $('.nextDeparture .departingMinutes').textContent = minutesToDeparture + ' MIN'
          } else {
            $('.nextDeparture .departingMinutes').textContent = 'NOW'
          }
        } else {
          $('.nextDeparture .departingMinutes').textContent = ''
        }
      } else {
        $('.nextDeparture .scheduledDepartureTime').textContent = '--'
        $('.nextDeparture .destination').textContent = '--'
        $('.nextDeparture .departingMinutes').textContent = ''
      }
    } catch (e) {}
  })
}
$.ready(() => {
  updateBody()
  setTimeout(() => {
    updateBody()
    setInterval(updateBody, 1000 * 30)
  }, 30000 - (+new Date() % 30000))
})
