let northernGroup = [
  "Craigieburn",
  "Sunbury",
  "Upfield",
  "Werribee",
  "Williamstown",
  "Showgrounds/Flemington"
]

let cliftonHillGroup = [
  "Mernda",
  "Hurstbridge"
]

function formatTime(time) {
  let hours = time.getHours()
  let minutes = time.getMinutes()
  let mainTime = ''

  mainTime += (hours % 12) || 12
  mainTime += ':'
  if (minutes < 10) mainTime += '0'
  mainTime += minutes

  if (time.getHours() >= 12)
    mainTime += 'pm'
  else
    mainTime += 'am'

  return mainTime
}

function getStoppingPattern(firstDeparture) {
  let {additionalInfo} = firstDeparture
  let stoppingPattern = ''
  if (additionalInfo.expressCount === 0)
    stoppingPattern = 'Stops All'
  else if (additionalInfo.expressCount <= 2)
    stoppingPattern='Ltd Express'
  else stoppingPattern = 'Express'

  if (isCityStop || additionalInfo.direction === 'Up') {
    if (additionalInfo.viaCityLoop) stoppingPattern += ' via City Loop'
    else {
      if (northernGroup.includes(firstDeparture.trip.routeName)) stoppingPattern += ' via Sthn Cross'
      else if (cliftonHillGroup.includes(firstDeparture.trip.routeName)) stoppingPattern += ' via Jolimont' //?
      else stoppingPattern += ' via Richmond'
    }
  }
  if (firstDeparture.type === 'vline') stoppingPattern = 'No Suburban Passengers'

  return stoppingPattern
}

function createStationRow(name, imgSource) {
  let style = 'height: 16px !important;'
  return `<div class="stationRow" style="${imgSource.includes('stub') ? style : ''}">`
  + (imgSource.includes('stub') ?
    `<img src="/static/images/mockups/station-${imgSource}.svg" height="16px" width="42px" style="${style}">`
  : `<img src="/static/images/mockups/station-${imgSource}.svg">`)
  + `<p class="${imgSource}">${name}</p>
</div>`
}

function setNoDeparturesActive(active) {
  if (active) {
    $('.topLineBanner').className = 'topLineBanner no-line'
    $('.noDepartures').style = 'display: block;'
    $('.firstDepartureInfo').style = 'display: none;'
    $('.firstDepartureInfo~.greyLine').style = 'display: none;'
    $('.stoppingAt').style = 'display: none;'
  } else {
    $('.noDepartures').style = 'display: none;'
    $('.firstDepartureInfo').style = 'display: flex;'
    $('.firstDepartureInfo~.greyLine').style = 'display: block;'
    $('.stoppingAt').style = 'display: block;'
  }
}

setInterval(() => {
  $.ajax({
    method: 'POST'
  }, (err, status, body) => {
    let {departures} = body

    setNoDeparturesActive(!departures.length)
    if (departures.length) {
      let firstDeparture = departures[0]
      let next4Departures = departures.concat([null, null, null, null]).slice(1, 5)

      let firstDepartureClass = firstDeparture.codedLineName
      if (firstDeparture.type === 'vline') firstDepartureClass = 'vline'

      $('.topLineBanner').className = 'topLineBanner ' + firstDepartureClass
      $('.firstDepartureInfo .scheduledDepartureTime').textContent = formatTime(new Date(firstDeparture.scheduledDepartureTime))
      $('.firstDepartureInfo .destination').textContent = firstDeparture.destination
      $('.firstDepartureInfo .stoppingPattern').textContent = getStoppingPattern(firstDeparture)
      $('.firstDepartureInfo .platform').className = 'platform ' + firstDepartureClass
      $('.firstDepartureInfo .platform span').textContent = firstDeparture.platform
      $('.firstDepartureInfo .timeToDeparture span').textContent = firstDeparture.prettyTimeToDeparture
      $('.stoppingAt').className = 'stoppingAt ' + firstDepartureClass

      let n
      let stopCount = firstDeparture.additionalInfo.screenStops.length

      if (stopCount >= 32) n = 17
      // else if (stopCount >= 24) n = 18 // honestly idk how tf this works
      // else if (stopCount >= 20) n = 16
      else if (stopCount >= 12) n = 16 // ?? should really have checked but aw - moorabbin shorts
      // else if (stopCount >= 12) n = 12
      else n = 12

      let firstNStations = firstDeparture.additionalInfo.screenStops.slice(0, n)
      let nextNStations = firstDeparture.additionalInfo.screenStops.slice(n)

      let stoppingHTML = `<div>` // left
      stoppingHTML += createStationRow(' ', 'stub')
      let hasTerminating = firstDeparture.additionalInfo.screenStops.length <= n
      stoppingHTML += `<div class="stationRow">
        <img src="/static/images/mockups/station-stops-at.svg" class="${firstDepartureClass}"/>
        <p class="${firstDepartureClass}">${firstNStations[0].stopName}</p>
      </div>`
      for (station of firstNStations.slice(1, hasTerminating ? -1 : n))
        stoppingHTML += createStationRow(station.stopName, station.isExpress ? 'express' : 'stops-at')

      if (hasTerminating)
        stoppingHTML += createStationRow(firstNStations.slice(-1)[0].stopName, 'terminates')
      else {
        stoppingHTML += createStationRow(' ', 'halfstub')
        stoppingHTML += createStationRow(' ', 'filler')
      }

      stoppingHTML += `</div><div>` // right
      if (nextNStations.length) {
        stoppingHTML += createStationRow(' ', 'halfstub')
        stoppingHTML += createStationRow(' ', 'filler')
        for (station of nextNStations.slice(0, -1))
          stoppingHTML += createStationRow(station.stopName, station.isExpress ? 'express' : 'stops-at')
        stoppingHTML += createStationRow(nextNStations.slice(-1)[0].stopName, 'terminates')
      }
      stoppingHTML += `</div>`

      let containerDIV = document.createElement('div')
      containerDIV.innerHTML = stoppingHTML
      setTimeout(() => {
        $('.stoppingAt').innerHTML = ''
        $('.stoppingAt').appendChild(containerDIV)
      }, hasTerminating ? 100 : 200)
    }

    let departureDIVs = Array.from(document.querySelectorAll('.smallDeparture'))
    departures.concat([null, null, null, null, null]).slice(1, 5).forEach((departure, i) => {
      let departureDIV = departureDIVs[i]
      if (!!departure) {
        let departureClass = departureClass
        if (departure.type === 'vline') departureClass = 'vline'

        $('.sideBar', departureDIV).className = 'sideBar ' + departureClass
        $('.sideBar~p', departureDIV).textContent = formatTime(new Date(departure.scheduledDepartureTime))

        $('.centre p', departureDIV).textContent = departure.destination

        $('.right .platform', departureDIV).className = 'platform ' + departureClass
        $('.right .platform p', departureDIV).textContent = departure.platform

        $('.right .timeToDeparture p', departureDIV).textContent = departure.prettyTimeToDeparture.replace(' ', '')
      } else {
        $('.sideBar', departureDIV).className = 'sideBar no-line'
        $('.sideBar~p', departureDIV).textContent = '--'

        $('.centre p', departureDIV).textContent = '--'

        $('.right .platform', departureDIV).className = 'platform no-line'
        $('.right .platform p', departureDIV).innerHTML = '&nbsp;'

        $('.right .timeToDeparture p', departureDIV).innerHTML = '&nbsp;'
      }
    })
  })
}, 1000 * 15)
