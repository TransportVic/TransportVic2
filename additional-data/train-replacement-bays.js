function getStopGTFSID(stopGTFSID, n) { return stopGTFSID + 500000000 + n * 10000000 }

module.exports = {
  'Stony Point': [{
    towards: 'Frankston',
    location: {
      type: 'Point',
      coordinates: [145.222326, -38.373771]
    },
    along: 'Stony Point Road',
    bayDesignation: null,
    stopGTFSID: getStopGTFSID(19827, 1)
  }],
  'Huntingdale': [{
    towards: 'City',
    location: {
      type: 'Point',
      coordinates: [145.103387, -37.911015]
    },
    along: 'Haughton Road',
    bayDesignation: 'Bay F',
    stopGTFSID: getStopGTFSID(19916, 1) // Suspect there is one on the totem pole
  }, {
    towards: 'Cranbourne & Pakenham',
    location: {
      type: 'Point',
      coordinates: [145.103005, -37.910876]
    },
    along: 'Haughton Road',
    bayDesignation: 'Bay C',
    stopGTFSID: getStopGTFSID(19916, 2) // Suspect there is one on the totem pole
  }],
  'Glen Waverley': [{
    towards: 'City',
    location: {
      type: 'Point',
      coordinates: [145.163044, -37.879917]
    },
    along: 'Coleman Parade',
    bayDesignation: null,
    stopGTFSID: getStopGTFSID(19873, 1)
  }]
}
