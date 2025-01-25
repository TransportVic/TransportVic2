const utils = require('../../utils')
const ptvAPI = require('../../ptv-api')
const fs = require('fs')
const path = require('path')

ptvAPI.getPTVKey(undefined, 12000).then(async key => {
  let data = JSON.parse(await utils.request('https://www.ptv.vic.gov.au/lithe/stored-stops-all?__tok=' + key, {
    timeout: 12000
  }))

  fs.writeFileSync(path.join(__dirname, 'tram-stops.json'), JSON.stringify(data.stops.filter(stop => {
    if (stop.primaryChronosMode === '1') return true
    if (stop.primaryChronosMode === '2') { // Bus using tram stop
      return stop.title.includes('#') || stop.title.match(/^(D?\d+[a-zA-Z]?)-/)
    }

    return false
  }).map(stop => {
    let stopNumberParts = stop.title.match(/^(D?\d+[a-zA-Z]?)-/)
    let stopName = stop.title.split(' #')[0]
    let stopNumber = stop.title.split(' #')[1]

    if (stopNumberParts) {
      stopNumber = stopNumberParts[1]
      stopName = stopName.replace(stopNumberParts[0], '')
    }

    stopName = stopNumber + '-' + stopName

    return {
      stopName, stopNumber, stopID: stop.id
    }
  })))

  process.exit()
})
