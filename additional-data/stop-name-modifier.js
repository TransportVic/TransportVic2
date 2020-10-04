module.exports = stopName => {
  if (stopName === 'Monash University') return 'Monash University Bus Loop'

  if (stopName === 'Chisholm TAFE/Stud Road') return 'Chisholm TAFE - Dandenong/Stud Road'
  if (stopName === 'Chisholm Institute/Cleeland Street') return 'Chisholm TAFE - Dandenong/Cleeland Street'
  if (stopName === 'Chisholm TAFE/Henry Wilson Drive') return 'Chisholm TAFE - Rosebud/Henry Wilson Drive'
  if (stopName === 'Chisholm Institute of TAFE/Beach Street') return 'Chisholm TAFE - Frankston/Beach Street'
  if (stopName === 'Chisholm Institute Of TAFE/Beach Street') return 'Chisholm TAFE - Frankston/Beach Street'

  if (stopName === 'Kangan Batman TAFE/Buckley Street') return 'Kangan TAFE - Docklands/Buckley Street'

  if (stopName === 'Swinburne TAFE/Norton Road') return 'Swinburne TAFE - Croydon/Norton Road'
  if (stopName === 'Swinburne TAFE/Stud Road') return 'Swinburne TAFE - Wantirna/Stud Road'

  if (stopName === 'Holmesglen TAFE/Warrigal Road') return 'Holmesglen TAFE - Chadstone/Warrigal Road'

  if (stopName === '(opp) 5 Bass School Road') return '5 Bass School Road'

  if (stopName === 'Clarendon Street/Whiteman Street') return 'Clarendon Street Junction/Whiteman Street'
  if (stopName === 'Port Junction/79 Whiteman Street') return 'Clarendon Street Junction/79 Whiteman Street'

  if (stopName === 'Newport Interchange/Mason Street') return 'Newport Railway Station/Mason Street'
  if (stopName === 'Box Hill Bus Station/Station Street') return 'Box Hill Railway Station/Station Street'

  if (stopName.includes('Freeburgh') && stopName.includes('Hall')) {
    return stopName.replace(/Freeburgh \w*? ?Hall/, 'Freeburgh Community Hall')
  }

  if (stopName === 'Dalgetty Street/Holding Street') return 'Dalgetty Road/Holding Street'
  if (stopName === 'Heathcliff Lane/Royal Terrace') return 'Heathcliffe Lane/Royal Tce'

  return stopName
}
