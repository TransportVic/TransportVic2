const fs = require('fs')
const crypto = require('crypto')
let data = require('./application/static/misc/track-centreline.json')

function sha1(data) {
    let hash = crypto.createHash('sha1')
    hash.update(data)
    return hash.digest('hex')
}

data.features = data.features.map(feature => {
  let {geometry, properties} = feature
  let {FACILITY, GAUGE, ELECTRIC} = properties

  let key = FACILITY + GAUGE + ELECTRIC + geometry.coordinates.join('')
  let id = sha1(key)
  feature.properties.ID = id
  return feature
})

fs.writeFileSync('./application/static/misc/track-centreline-named.json', JSON.stringify(data))
