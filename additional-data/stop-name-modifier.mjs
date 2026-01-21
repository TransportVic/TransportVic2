import nameOverrides from '../transportvic-data/excel/stops/name-overrides.json' with { type: 'json' }

export default stopName => {
  return nameOverrides[stopName] || stopName
}
