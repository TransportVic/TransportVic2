let standard12 = [
  'North Melbourne',
  'Sunbury', // check
  'Ardeer',
  'Deer Park',
  'Tarneit',
  'Wyndham Vale',
  'Little River',
  'Lara',
  'Corio',
  'North Shore',
  'North Geelong',
  'Ballan', //check
  'Bacchus Marsh',
  'Melton',
  'Cobblebank',
  'Rockbank',
  'Caroline Springs',
  'Bendigo', //Check
  'Broadmeadows',
  'Craigieburn', //check
  'Donnybrook',
  'Wallan',
  'Heathcote Junction',
  'Wandong',
  'Kilmore East',
  'Broadford',
  'Tallarook',
  'Avenel',
  'Euroa',
  'Violet Town',
  'Springhurst',
  'Chiltern',
  'Benalla',
  'Albury',
  'Clayton',
  'Berwick',
  'Pakenham',
  'Nar Nar Goon',
  'Tynong',
  'Garfield',
  'Drouin',
  'Warragul',
  'Yarragon'
]

let singlePlatforms = [
  'South Geelong',
  'Marshall',
  'Waurn Ponds',
  'Winchelsea',
  'Birregurra',
  'Colac',
  'Camperdown',
  'Terang',
  'Sherwood Park',
  'Warrnambool',
  'Beaufort',
  'Creswick',
  'Clunes',
  'Talbot',
  'Maryborough',
  'Malmsbury',
  'Eaglehawk',
  'Raywood',
  'Dingee',
  'Pyramid',
  'Kerang',
  'Swan Hill',
  'Epsom',
  'Huntly',
  'Goornong',
  'Elmore',
  'Rochester',
  'Echuca',
  'Nagambie',
  'Murchison East',
  'Mooroopna',
  'Shepparton',
  'Wangaratta',
  'Wodonga',
  'Bunyip',
  'Longwarry',
  'Trafalgar',
  'Moe',
  'Morwell',
  'Traralgon',
  'Rosedale',
  'Sale',
  'Stratford',
  'Bairnsdale',

  'Stawell',
  'Horsham',
  'Dimboola',
  'Nhill',
  'Bordertown',
  'Murray Bridge'
]

export default (stationName, departureTimeMinutes, line, direction, isWeekday) => {
  let isUp = direction === 'Up'

  if (line === 'The Overland') {
    if (stationName === 'North Shore') return 3
    if (stationName === 'Ararat') return 1
    if (stationName === 'Southern Cross') return 2
  }

  if (stationName === 'Flinders Street') return 6
  if (stationName === 'Richmond') {
    if (!isUp) return 6
    else return 5
  }

  if (stationName === 'Caulfield') {
    if (isUp) return 3
    else return 4
  }

  if (stationName === 'Dandenong') {
    if (isUp) return 2
    else return 3
  }

  if (stationName === 'Broadmeadows') {
    if (line === 'Albury') return 3
  }

  if (stationName === 'Essendon') {
    if (isUp) return 2
    else return 3
  }

  if (stationName === 'Albury') {
    if (line === 'Albury') return 2
    else return 1
  }

  if (stationName === 'Seymour') {
    if (line === 'Albury') return 1
    if (isUp) return 2
    else return 3
  }

  if (stationName === 'Benalla') {
    if (line === 'Albury') return 1
    else if (isUp) return 2
    else return 1
  }

  if (standard12.includes(stationName)) {
    if (isUp) return 1
    else return 2
  }
  if (stationName === 'Footscray' || stationName === 'Sunshine') {
    if (isUp) return 3
    else return 4
  }
  if (stationName === 'Watergardens') {
    if (isUp) return 1
    else return 3
  }
  if (stationName === 'Geelong') {
    if (isUp) return 3
    else return 1
  }

  let rfrReverses = [
    'Clarkefield',
    'Riddells Creek',
    'Gisborne',
    'Macedon',
    'Woodend',
    'Kyneton'
  ]
  if (rfrReverses.includes(stationName)) {
    if (departureTimeMinutes < 9 * 60) { // RFR platform reverse, check time??
      if (isUp) return 2
      else return 1
    } else {
      if (isUp) return 1
      else return 2
    }
  }

  if (stationName === 'Kangaroo Flat') {
    if (departureTimeMinutes === 0) return 2 // check
    else return 1
  }

  if (stationName === 'Ballarat') {
    if (isWeekday) {
      let plat2 = [
        [6,42],
        [15,42],
        [17,45],
        [18, 2],
        [18,52],
        [ 7,42],
        [ 9,13]
      ].map(e => e[0] * 60 + e[1])
      if (plat2.includes(departureTimeMinutes)) return 2
      else return 1
    } else {
      return 1
    }
  }

  if (stationName === 'Wendouree') {
     if (line === 'Ballarat') return 2
     else return 2
  }

  if (stationName === 'Ararat') {
    return 2
  }

  if (stationName === 'Werribee') return 2 // Per Metro platforms being altered it appears to be 2

  if (singlePlatforms.includes(stationName)) return 1
}
