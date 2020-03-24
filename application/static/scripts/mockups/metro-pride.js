let baseURL = '/mockups/pride/audio/'
let clips = [
//   'ringtone',
//   'services-departing',
//   'south-yarra-rising',
//   'platform',
//   'six-falling',
//   'are',
//   'the',
//   'twelve-rising',
//   'ten-falling',
//   'pakenham-falling',
//   {pause: 100},
//   'stopping-all-stations',
//   'pakenham-rising',
//   {pause: 100},
//   'departing-platform',
//   'one-rising',
//   'in',
//   'seven-falling',
//   'minutes',
//   {pause: 200},
//   'always-touch-on',
//   'beep',
// ]
  'ringtone',
  'services-departing',
  'pakenham-rising',
  'platforms',
  'one-rising',
  'and',
  'two-falling',
  'are',
  'the',
  'seven-rising',
  'zero-o',
  'one-rising',
  'city-loop-rising',
  'stopping-all-stations',
  'dandenong-falling',
  'running-express-from',
  'dandenong-rising',
  'to',
  'noble-park-rising',
  'stopping-all-stations',
  'springvale-falling',
  'running-express-from',
  'springvale-rising',
  'to',
  'clayton-falling',
  'stopping-all-stations',
  'caulfield-falling',
  'running-express-from',
  'caulfield-rising',
  'to',
  'south-yarra-falling',
  'departing-platform-rising',
  'one-rising',
  'in',
  'two-falling',
  'minutes',
  {pause: 500},
  'always-touch-on',
  'beep'
]

let cachedAudio = {
}

function playAudio(name) {
  if (name.pause) {
    return new Promise(resolve => {
      setTimeout(resolve, name.pause)
    })
  }
  return new Promise(resolve => {
    cachedAudio[name].play()
    setTimeout(() => {
      resolve()
    }, cachedAudio[name].duration * 1000 - 25)
  })
}

function preloadAudio(name) {
  let url = baseURL + name + '.ogg'
  if (!name.pause)
    return new Promise(resolve => {
      let audio = new Audio()
      audio.on('canplaythrough', () => {
        cachedAudio[name] = audio
        resolve()
      })
      audio.src = url
      audio.load()
    })
}

async function preloadClips(clips) {
  for (clip of clips) {
    await preloadAudio(clip)
  }
}

async function playClips(clips) {
  for (clip of clips) {
    await playAudio(clip)
  }
}

preloadClips(clips)

$('#button').on('click', () => {
  playClips(clips)
})
