let bays = require('../../transportvic-data/excel/bus/bays/bus-bays.json')

module.exports = Object.keys(bays).reduce((acc, stopGTFSID) => ({
  ...acc,
  ...(bays[stopGTFSID].length ? {
    [stopGTFSID]: `Bay ${bays[stopGTFSID]}`
  }: {})
}))