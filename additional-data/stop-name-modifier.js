const nameOverrides = require('../transportvic-data/excel/stops/name-overrides.json')

module.exports = stopName => {
  return nameOverrides[stopName] || stopName
}
