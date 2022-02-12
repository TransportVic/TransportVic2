const utils = require('../../../utils')
const ptvAPI = require('../../../ptv-api')
const fs = require('fs')
const path = require('path')

ptvAPI.getPTVKey(undefined, 12000).then(async key => {
  let data = JSON.parse(await utils.request('https://www.ptv.vic.gov.au/lithe/stored-stops-all?__tok=' + key, {
    timeout: 12000
  }))

  fs.writeFileSync(path.join(__dirname, 'tram-stops.json'), JSON.stringify(data.stops.filter(x => x.primaryChronosMode === '1').map(x => {
    let m = x.title.match(/^(D?\d+[a-zA-Z]?)-/)
    let stopName = x.title.split(' #')[0]
    let stopNumber = x.title.split(' #')[1]

    if (m) {
      stopNumber = m[1]
      stopName = stopName.replace(m[0], '')
    }

    stopName = stopNumber + '-' + stopName

    return {
      stopName, stopNumber, stopID: x.id
    }
  })))

  process.exit()
})
