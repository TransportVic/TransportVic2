let northernGroup = [
  "2-B31", // craigieburn
  "2-SYM",
  "2-UFD",
  "2-WBE",
  "2-WMN",
  "2-ain"
]

let cliftonHillGroup = [
  "2-MER",
  "2-HBG"
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

  if (additionalInfo.viaCityLoop) stoppingPattern += ' via City Loop'
  else {
    if (northernGroup.includes(firstDeparture.trip.routeGTFSID)) stoppingPattern += ' via Sthn Cross'
    else if (cliftonHillGroup.includes(firstDeparture.trip.routeGTFSID)) stoppingPattern += ' via Jolimont' //?
    else stoppingPattern += ' via Richmond'

  }

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

      $('.topLineBanner').className = 'topLineBanner ' + firstDeparture.codedLineName
      $('.firstDepartureInfo .scheduledDepartureTime').textContent = formatTime(new Date(firstDeparture.scheduledDepartureTime))
      $('.firstDepartureInfo .destination').textContent = firstDeparture.trip.destination.slice(0, -16)
      $('.firstDepartureInfo .stoppingPattern').textContent = getStoppingPattern(firstDeparture)
      $('.firstDepartureInfo .platform').className = 'platform ' + firstDeparture.codedLineName
      $('.firstDepartureInfo .platform span').textContent = firstDeparture.platform
      $('.firstDepartureInfo .timeToDeparture span').textContent = firstDeparture.prettyTimeToDeparture
      $('.stoppingAt').className = 'stoppingAt ' + firstDeparture.codedLineName

      let n
      let stopCount = firstDeparture.additionalInfo.screenStops.length

      if (stopCount >= 31) n = 20
      else if (stopCount >= 28) n = 18
      else if (stopCount >= 24) n = 17
      else if (stopCount >= 16) n = 16
      // else if (stopCount >= 12) n = 12
      else n = 12

      let firstNStations = firstDeparture.additionalInfo.screenStops.slice(0, n)
      let nextNStations = firstDeparture.additionalInfo.screenStops.slice(n)

      let stoppingHTML = `<div>` // left
      stoppingHTML += createStationRow(' ', 'stub')
      let hasTerminating = firstDeparture.additionalInfo.screenStops.length <= n
      stoppingHTML += `<div class="stationRow">
        <img src="/static/images/mockups/station-stops-at.svg" class="${firstDeparture.codedLineName}"/>
        <p class="${firstDeparture.codedLineName}">${firstNStations[0].stopName}</p>
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
        stoppingHTML += createStationRow(' ', 'stub')
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
        $('.sideBar', departureDIV).className = 'sideBar ' + departure.codedLineName
        $('.sideBar~p', departureDIV).textContent = formatTime(new Date(departure.scheduledDepartureTime))

        $('.centre p', departureDIV).textContent = departure.trip.destination.slice(0, -16)

        $('.right .platform', departureDIV).className = 'platform ' + departure.codedLineName
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
