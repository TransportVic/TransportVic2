function shorternName(stopName) {
  if (stopName === 'Upper Ferntree Gully') return 'Upper F.T Gully'
  if (stopName === 'North Melbourne') return 'Nth Melbourne'
  if (stopName === 'South Kensington') return 'Sth Kensington'
  if (stopName === 'Flemington Racecourse') return 'Flemington Races'

  return stopName
}

function createStoppingPatternID(side, stoppingPattern) {
  return stoppingPattern.map(e => `${side}-${e.stopName}${e.isExpress}`).join(',')
}

let currentPattern = null

function addStoppingPattern(side, stops) {
  let newPatternID = createStoppingPatternID(side, stops)
  if (currentPattern === newPatternID) return true

  currentPattern = newPatternID
  let {stopColumns, size} = splitStops(stops, false, {
    MAX_COLUMNS: 3,
    CONNECTION_LOSS: 2,
    MIN_COLUMN_SIZE: 5,
    MAX_COLUMN_SIZE: 17
  })

  let selector = `.${side} .stops`

  $(selector).innerHTML = ''

  let check = []

  stopColumns.forEach((stopColumn, i) => {
    let outerColumn = document.createElement('div')
    let html = ''

    stopColumn.forEach(stop => {
      let className = stop.isExpress ? ' class="express"' : ''
      html += `<span${className}>${shorternName(stop.stopName)}</span><br>`
    })

    outerColumn.innerHTML = `<div>${html}</div>`
    outerColumn.className = `stopsColumn columns-${size}`

    $(selector).appendChild(outerColumn)

    check.push($('div', outerColumn))
  })

  setTimeout(() => {
    check.forEach(container => {
      let computed = getComputedStyle(container.parentElement)
      let containerWidth = parseFloat(computed.width) + 0.3 * parseFloat(computed.marginRight)
      let threshold = containerWidth * 0.9

      Array.from(container.children).forEach(station => {
        if (station.tagName === 'BR') return

        let childWidth = parseFloat(getComputedStyle(station).width)
        if (childWidth >= threshold) {
          station.className = 'squish'
        }
      })
    })
  }, 1)
}


function updateBody() {
  let stops = [
{ isExpress: false, stopName: 'Southern Cross' },
{ isExpress: false, stopName: 'Flinders Street' },
{ isExpress: false, stopName: 'Richmond' },
{ isExpress: false, stopName: 'South Yarra' },
{ isExpress: true, stopName: 'Hawksburn' },
{ isExpress: true, stopName: 'Toorak' },
{ isExpress: true, stopName: 'Armadale' },
{ isExpress: true, stopName: 'Malvern' },
{ isExpress: false, stopName: 'Caulfield' },
{ isExpress: true, stopName: 'Carnegie' },
{ isExpress: true, stopName: 'Murrumbeena' },
{ isExpress: true, stopName: 'Hughesdale' },
{ isExpress: false, stopName: 'Oakleigh' },
{ isExpress: false, stopName: 'Huntingdale' },
{ isExpress: false, stopName: 'Clayton' },
{ isExpress: true, stopName: 'Westall' },
{ isExpress: false, stopName: 'Springvale' },
{ isExpress: true, stopName: 'Sandown Park' },
{ isExpress: false, stopName: 'Noble Park' },
{ isExpress: false, stopName: 'Dandenong' },
{ isExpress: false, stopName: 'Hallam' },
{ isExpress: false, stopName: 'Narre Warren' },
{ isExpress: false, stopName: 'Berwick' },
{ isExpress: false, stopName: 'Beaconsfield' },
{ isExpress: false, stopName: 'Officer' },
{ isExpress: false, stopName: 'Cardinia Road' },
{ isExpress: false, stopName: 'Pakenham' }
  ]

  addStoppingPattern('left', stops)
  addStoppingPattern('right', stops)
}

$.ready(() => {
  updateBody()
})
