window.edi = null
window.bottomRow = null

let EDSFormats = {}
let EDSData = {}
let EDSImages = {}

let width = 110
let height = 7
let ledSize = 0.008
let font

let bottomRowTimeout = 0
let pauseTimeout = 0
let bottomRowText = []
let stopScrolling = false

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

function asyncPause(milliseconds) {
  return new Promise(resolve => {
    pauseTimeout = setTimeout(resolve, milliseconds)
  })
}

async function animateScrollingText(matrix, text, spacing, xPosition=0) {
  let textObj = new TextObject(text, font, new Position(xPosition, 0), spacing)
  let textWidth = textObj.width

  let iterationCount = textWidth - xPosition + 20

  for (let i = 0; i < iterationCount; i++) {
    if (stopScrolling) {
      stopScrolling = false
      return
    }
    matrix.clearRectangle(xPosition, 0, 120, 7)
    matrix.drawText(textObj)
    textObj.position.x--
    await asyncPause(15)
  }
}

$.ready(() => {
  generateLEDCssCode()

  font = Font.fromNameString('EDI-7')

  edi = new LEDMatrix(width, height, $('#edi'))

  legacyDrawText(edi, 'Arriving Oakleigh', 1, 10, 0)
})

window.addEventListener('resize', generateLEDCssCode);
