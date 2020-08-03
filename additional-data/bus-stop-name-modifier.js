module.exports = stopName => {
  if (stopName === 'Monash University') return 'Monash University Bus Loop'

  if (stopName === 'Chisholm TAFE/Stud Road') return 'Chisholm TAFE - Dandenong/Stud Road'
  if (stopName === 'Chisholm TAFE/Henry Wilson Drive') return 'Chisholm TAFE - Rosebud/Henry Wilson Drive'

  if (stopName === 'Kangan Batman TAFE/Buckley Street') return 'Kangan TAFE - Docklands/Buckley Street'

  if (stopName === 'Swinburne TAFE/Norton Road') return 'Swinburne TAFE - Croydon/Norton Road'
  if (stopName === 'Swinburne TAFE/Stud Road') return 'Swinburne TAFE - Wantirna/Stud Road'

  if (stopName === 'Holmesglen TAFE/Warrigal Road') return 'Holmesglen TAFE - Chadstone/Warrigal Road'

  if (stopName === '(opp) 5 Bass School Road') return '5 Bass School Road'

  return stopName
}
