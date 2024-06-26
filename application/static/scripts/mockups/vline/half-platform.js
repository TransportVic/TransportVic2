function setMessagesActive(active) {
  if (active) {
    $('.message').style = 'display: flex;'
    $('.nextDeparture').style = 'display: none;'
    $('.stops').style = 'display: none';
  } else {
    $('.message').style = 'display: none;'
    $('.nextDeparture').style = 'display: flex;'
    $('.stops').style = 'display: flex';
  }
  $('.fullMessage').style = 'display: none;'
  $('.serviceMessage').style = 'display: none;'
  $('.left').style = 'display: block;'
  $('.right').style = 'display: flex;'
  $('.content').className = 'content'
}

function setFullMessageActive(active) {
  if (active) {
    $('.content').className = 'content announcements'
    $('.fullMessage').style = 'display: flex;'
    $('.stops').style = 'display: none';
    $('.left').style = 'display: none;'
    $('.right').style = 'display: none;'
  } else {
    $('.content').className = 'content'
    $('.fullMessage').style = 'display: none;'
    $('.nextDeparture').style = 'display: flex;'
    $('.stops').style = 'display: flex';
    $('.left').style = 'display: block;'
    $('.right').style = 'display: flex;'
  }
  $('.message').style = 'display: none;'
  $('.serviceMessage').style = 'display: none;'
}

function setDepartureInfoVisible(visible) {
  if (visible) {
    $('.departureInfo').style = ''
  } else {
    $('.departureInfo').style = 'opacity: 0;'
  }
}

function setNoDepartures() {
  $('.message').innerHTML = '<p class="large">No trains departing</p><p class="large"> from this platform</p>'
  setMessagesActive(true)
}

function setListenAnnouncements() {
  $('.fullMessage').innerHTML = '<img src="/static/images/mockups/announcements.svg" /><p>Please Listen for Announcements</p>'
  setFullMessageActive(true)
}

function createStoppingPatternID(stoppingPattern) {
  return stoppingPattern.map(e => `${e[0]}${e[1]}`).join(',')
}

let currentPattern = null

function addStoppingPattern(stops) {
  let newPatternID = createStoppingPatternID(stops)
  if (currentPattern === newPatternID) return true

  currentPattern = newPatternID

  stops = stops.filter(stop => vlineStops.includes(stop[0]))

  let stopColumns = []

  let start = 0
  let size = 5
  for (let i = 0; true; i++) {
    let end = start + size

    let part = stops.slice(start, end)
    if (part.length === 0) break
    stopColumns.push(part)
    start = end
  }

  $('.stops').innerHTML = ''

  let check = []

  stopColumns.forEach((stopColumn, i) => {
    let outerColumn = document.createElement('div')
    let html = ''

    stopColumn.forEach(stop => {
      if (stop[1])
        html += '<span>&nbsp;---</span><br>'
      else {
        html += `<span>${stop[0]}</span><br>`
      }
    })

    outerColumn.innerHTML = `<div>${html}</div>`
    outerColumn.className = `stopsColumn`

    $('.stops').appendChild(outerColumn)

    check.push($('div', outerColumn))
  })
}


function updateBody() {
  $.ajax({
    method: 'POST'
  }, (err, status, body) => {
    if (err) return setListenAnnouncements()

    try {
      departures = body.dep

      let firstDeparture = departures[0]
      if (!firstDeparture) {
        return setNoDepartures()
      }

      setDepartureInfoVisible(true)

      $('.firstDestination').textContent = firstDeparture.dest
      $('.scheduledDiv span:nth-child(2)').textContent = formatTime(new Date(firstDeparture.sch))

      $('.actualDiv span:nth-child(2)').textContent = minutesToDeparture(new Date(firstDeparture.est || firstDeparture.sch))

      addStoppingPattern(firstDeparture.stops.slice(1))

      let nextDepartures = [...departures.slice(1, 3), null, null].slice(0, 2)
      nextDepartures.forEach((departure, i) => {
        let div = $(`div.followingDeparture:nth-child(${i + 2})`)
        if (departure) {
          $('.scheduled', div).textContent = formatTime(new Date(departure.sch))
          $('.destination', div).textContent = departure.dest
          $('.actual', div).textContent = minutesToDeparture(new Date(departure.est || departure.sch))
          $('.stoppingType', div).textContent = departure.type
        } else {
          $('.scheduled', div).textContent = '--'
          $('.destination', div).textContent = '--'
          $('.actual', div).textContent = '--'
          $('.stoppingType', div).textContent = ''
        }
      })
    } catch (e) {
      console.error(e)
      setListenAnnouncements()
    }
  })
}

$.ready(() => {
  updateBody()
  setTimeout(() => {
    updateBody()
    setInterval(updateBody, 1000 * 30)
  }, 30000 - (+new Date() % 30000))
})


function setupClock() {
  setTime()
  let msToNextSecond = 1000 - (+new Date() % 1000)
  setTimeout(() => {
    setTime()
    setInterval(setTime, 1000)
  }, msToNextSecond)
}

function setTime() {
  $('.timeContainer span').textContent = formatTime(new Date(), { includeSeconds: 1 })
}

$.ready(() => {
  setupClock()
})



let vlineStops = ["Wallan","Melton","Rockbank","Deer Park","Sunbury","Ardeer","Craigieburn","Southern Cross","Albury","Ararat","Avenel","Bacchus Marsh","Bairnsdale","Ballan","Ballarat","Beaufort","Benalla","Bendigo","Birregurra","Broadford","Bunyip","Camperdown","Castlemaine","Chiltern","Clarkefield","Colac","Corio","Dingee","Donnybrook","Drouin","Eaglehawk","Echuca","Elmore","Euroa","Garfield","Geelong","Gisborne","Heathcote Junction","Kangaroo Flat","Kerang","Kilmore East","Kyneton","Lara","Little River","Longwarry","Macedon","Malmsbury","Marshall","Moe","Mooroopna","Morwell","Murchison East","Nagambie","Nar Nar Goon","North Geelong","North Shore","Pyramid","Riddells Creek","Rochester","Rosedale","Sale","Seymour","Shepparton","South Geelong","Springhurst","Stratford","Swan Hill","Tallarook","Terang","Trafalgar","Traralgon","Tynong","Violet Town","Wandong","Wangaratta","Warragul","Warrnambool","Winchelsea","Wodonga","Woodend","Yarragon","Flinders Street","North Melbourne","Footscray","Sunshine","Watergardens","Richmond","Caulfield","Clayton","Dandenong","Berwick","Pakenham","Essendon","Broadmeadows","Sherwood Park","Wendouree","Creswick","Clunes","Maryborough","Talbot","Waurn Ponds","Epsom","Wyndham Vale","Tarneit","Cobblebank","Caroline Springs","Culcairn","Henty","The Rock","Wagga Wagga","Junee","Cootamundra","Harden","Yass Junction","Gunning","Goulburn","Moss Vale","Campbelltown","Sydney Central"]

vlineStops = vlineStops.concat(['St. Albans', 'Keilor Plains', 'Diggers Rest']) // Old St. Albans Line
