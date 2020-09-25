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

let daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

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
  matrix.clearRectangle(0, 0, width, height)
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

  if (hours > 12) mainTime += ' PM'
  else mainTime += ' AM'

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

let bootupText = [
  {
    text: [
      { text: '10145001', font: 'EDI-7' },
      { text: 'G', font: 'EDI-5' },
      { text: ' 220C', font: 'EDI-7' }
    ]
  },
  { text: { text: 'CLOCK CHIP', font: 'EDI-7' }, duration: 500 },
  { text: { text: '32K RAM', font: 'EDI-7' }, duration: 500 },
  { text: { text: `${daysOfWeek[new Date().getDay()]} ${formatTime(new Date())}`, font: 'EDI-7' }, duration: 500 },
  {
    text: [
      { text: 'SERIAL ADDRESS =  ', font: 'EDI-5' },
      { text: '00 ', font: 'EDI-7' }
    ],
    align: 'left',
    duration: 1250
  }
]

$.ready(async () => {
  generateLEDCssCode()

  font = Font.fromNameString('EDI-7')

  edi = new LEDMatrix(width, height, $('#edi'))

  for (let text of bootupText) {
    drawObject(resolveTextPosition(
      TextObject.fromJSON(text.text, null, 1),
      text.align || 'centre-x,centre-y',
      edi
    ), edi)

    await asyncPause(text.duration || 1000)
    edi.clearRectangle(0, 0, width, height)
  }

  await asyncPause(500)

  drawObject(resolveTextPosition(
    TextObject.fromJSON({ text: 'Welcome to M>Train', font: 'EDI-7' }, null, 1),
    'centre-x,centre-y',
    edi
  ), edi)
})

window.addEventListener('resize', generateLEDCssCode);
