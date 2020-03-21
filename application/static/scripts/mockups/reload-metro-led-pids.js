window.topRow = null
window.bottomRow = null

let EDSFormats = {}
let EDSData = {}
let EDSImages = {}

let width = 120
let height = 7
let ledSize = 0.007
let font

function generateLEDCssCode() {
    let cssData =
`
    .led {
        width: ${Math.ceil(window.innerWidth * ledSize)}px;
        height: ${Math.ceil(window.innerWidth * ledSize)}px;
        border-radius: ${Math.ceil(window.innerWidth * ledSize)}px;
    }

    .pids {
        width: ${width * Math.ceil(window.innerWidth * ledSize)}px;
        grid-template-columns: repeat(${width}, ${Math.ceil(window.innerWidth * ledSize)}px);
        grid-row-gap: ${Math.ceil(window.innerWidth * 0.001)}px;
        grid-auto-rows: ${Math.ceil(window.innerWidth * ledSize) - 1}px;
    }
`

    $('#led-style').textContent = cssData
}

function legacyDrawText(matrix, text, spacing, x, y) {
    matrix.clearRectangle(0, 0, 120, 7)
    matrix.drawText(new TextObject(text, font, new Position(x, y), spacing));
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

function checkAndUpdateTrains() {
  $.ajax({
    method: 'POST'
  }, (err, status, data) => {
    let nextDeparture = data.departures[0]
    if (nextDeparture) {
      let {scheduledDepartureTime, estimatedDepartureTime, destination} = nextDeparture

      legacyDrawText(topRow, `${formatTime(new Date(scheduledDepartureTime))} ${destination.toUpperCase()}`, 1, 0, 0)

      let timeDiff = new Date(estimatedDepartureTime) - new Date()
      let minutes = timeDiff / 1000 / 60

      if (!isNaN(minutes)) {
        minutes = Math.floor(minutes).toString()
        if (minutes === '0') minutes = 'NOW'

        let timeToDepart = new TextObject(minutes, font, new Position(0, 0), 1)
        timeToDepart.position.x = 120 - timeToDepart.width - 3
        topRow.drawText(timeToDepart)

        legacyDrawText(bottomRow, 'Stops All Stations', 1, 0, 0)
      }
    } else {
      legacyDrawText(topRow, 'NO TRAINS OPERATING', 1, 0, 0)
      legacyDrawText(bottomRow, 'CHECK TIMETABLE', 1, 0, 0)
    }
  })
}

$.ready(() => {
  generateLEDCssCode()

  font = Font.fromNameString('Metro-PIDS-7:5')

  topRow = new LEDMatrix(width, height, $('#top-pids'))
  bottomRow = new LEDMatrix(width, height, $('#bottom-pids'))

  legacyDrawText(topRow, 'CHECKING TRAINS...', 1, 0, 0)
  legacyDrawText(bottomRow, 'PLEASE WAIT', 1, 0, 0)

  // legacyDrawText(topRow, 'NO TRAINS OPERATING', 1, 0, 0)
  // legacyDrawText(bottomRow, 'REPLACEMENT BUSES', 1, 0, 0)

  // legacyDrawText(topRow, '7:41 BAIRNSDALE', 1, 0, 0)
  //
  // let timeToDepart = new TextObject('12', font, new Position(0, 0), 1)
  // timeToDepart.position.x = 120 - timeToDepart.width - 3
  // topRow.drawText(timeToDepart)
  //
  // legacyDrawText(bottomRow, 'NO SUBURBAN PASSENGERS', 1, 0, 0)

  checkAndUpdateTrains()
  setInterval(checkAndUpdateTrains, 1000 * 30)
})

window.addEventListener('resize', generateLEDCssCode);
