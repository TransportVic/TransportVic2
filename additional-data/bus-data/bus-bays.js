let bays = require('../../transportvic-data/excel/bus/bays/bus-bays.json')

Object.keys(bays).forEach(stop => bays[stop] = `Bay ${bays[stop]}`)
module.exports = bays