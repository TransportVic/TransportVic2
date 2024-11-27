module.exports = stopName => {
  if (stopName === 'Monash University') return 'Monash University Bus Loop'

  if (stopName === 'Chisholm TAFE/Stud Road') return 'Chisholm TAFE - Dandenong/Stud Road'
  if (stopName === 'Chisholm Institute/Cleeland Street') return 'Chisholm TAFE - Dandenong/Cleeland Street'
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
  if (stopName === 'Ballarat Bus Interchange') return 'Ballarat Railway Station'

  if (stopName.includes('Freeburgh') && stopName.includes('Hall')) {
    return stopName.replace(/Freeburgh \w*? ?Hall/, 'Freeburgh Community Hall')
  }

  if (stopName === 'Dalgetty Street/Holding Street') return 'Dalgetty Road/Holding Street'
  if (stopName === 'New Quay Promenade/Docklands Drive') return 'NewQuay Promenade/Docklands Drive'

  if (stopName === 'Melbourne University/Royal Parade') return 'Melbourne University Royal Parade Stop/Royal Parade'
  if (stopName === 'Melbourne University/Swanston Street') return 'Melbourne University Swanston Street Stop/Swanston Street'
  if (stopName === 'Melbourne University/Grattan Street') return 'Melbourne University Grattan Street Stop/Grattan Street'
  if (stopName === 'Melbourne University/Pelham Street') return 'Melbourne University Pelham Street Stop/Pelham Street'

  if (stopName === 'Arts Precinct/Sturt Street') return 'Sturt Street/Southbank Boulevard'
  if (stopName === 'Flemington Racecourse/Racecourse Road') return 'Ascot Vale Road/Racecourse Road'

  if (stopName.includes('Center')) return stopName.replace('Center', 'Centre')
  if (stopName === 'Coles Supermarket/Aitken Street') return 'Gisborne Town Centre/Aitken Street'

  return stopName
}
