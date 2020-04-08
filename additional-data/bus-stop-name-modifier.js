module.exports = stopName => {
  if (stopName === 'Monash University') return 'Monash University Bus Loop'

  if (stopName === 'Chisholm Institute Of TAFE/Beach Street') return 'Chisholm TAFE - Frankston/Beach Street'
  if (stopName === 'Chisholm Institute of TAFE/Beach Street') return 'Chisholm TAFE - Frankston/Beach Street'
  if (stopName === 'Chisholm TAFE Dandenong/Stud Road') return 'Chisholm TAFE - Dandenong/Stud Road'
  if (stopName === 'Chisholm TAFE/Cleeland Street') return 'Chisholm TAFE - 311/Cleeland Street'
  if (stopName === 'Chisholm TAFE - Rosebud Campus/Henry Wilson Drive') return 'Chisholm TAFE - Rosebud/Henry Wilson Drive'

  if (stopName === 'Kangan Batman TAFE/Buckley Street') return 'Kangan TAFE - Docklands/Buckley Street'

  if (stopName === 'Swinburne TAFE/Norton Road') return 'Swinburne TAFE - Croydon/Norton Road'
  if (stopName === 'Swinburne TAFE/Stud Road') return 'Swinburne TAFE - Wantirna/Stud Road'

  if (stopName === 'Holmesglen TAFE/Warrigal Road') return 'Holmesglen TAFE - Chadstone/Warrigal Road'

  if (stopName === '(opp) 5 Bass School Road') return '5 Bass School Road'

  return stopName
}
