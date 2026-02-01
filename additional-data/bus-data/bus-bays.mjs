import bays from '../../transportvic-data/excel/bus/bays/bus-bays.json' with { type: 'json' }

export default Object.keys(bays).reduce((acc, stopGTFSID) => ({
  ...acc,
  ...(bays[stopGTFSID].length ? {
    [stopGTFSID]: `Bay ${bays[stopGTFSID]}`
  }: {})
}))