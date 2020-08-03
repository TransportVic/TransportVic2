let lines = {
  Gippsland: [
    'Southern Cross',
    'Nar Nar Goon',
    'Tynong',
    'Garfield',
    'Bunyip',
    'Longwarry',
    'Drouin',
    'Warragul',
    'Yarragon',
    'Trafalgar',
    'Moe',
    'Morwell',
    'Traralgon',
    'Rosedale',
    'Sale',
    'Stratford',
    'Bairnsdale'
  ],
  Shepparton: [
    'Southern Cross',
    'Donnybrook',
    'Wallan',
    'Heathcote Junction',
    'Wandong',
    'Kilmore East',
    'Broadford',
    'Tallarook',
    'Seymour',
    'Nagambie',
    'Murchison East',
    'Mooroopna',
    'Shepparton'
  ],
  Ararat: [
    'Southern Cross',
    'Ardeer',
    'Deer Park',
    'Caroline Springs',
    'Rockbank',
    'Cobblebank',
    'Melton',
    'Bacchus Marsh',
    'Ballan',
    'Ballarat',
    'Wendouree',
    'Beaufort',
    'Ararat'
  ],
  Maryborough: [
    'Southern Cross',
    'Footscray',
    'Deer Park',
    'Caroline Springs',
    'Rockbank',
    'Cobblebank',
    'Melton',
    'Bacchus Marsh',
    'Ballan',
    'Ballarat',
    'Creswick',
    'Clunes',
    'Talbot',
    'Maryborough',
  ],
  Echuca: [
    'Southern Cross',
    'Clarkefield',
    'Riddells Creek',
    'Gisborne',
    'Macedon',
    'Woodend',
    'Kyneton',
    'Malmsbury',
    'Castlemaine',
    'Kangaroo Flat',
    'Bendigo',
    'Epsom', 'Elmore',
    'Rochester',
    'Echuca'
  ],
  'Swan Hill': [
    'Southern Cross',
    'Sunbury',
    'Clarkefield',
    'Riddells Creek',
    'Gisborne',
    'Macedon',
    'Woodend',
    'Kyneton',
    'Malmsbury',
    'Castlemaine',
    'Kangaroo Flat',
    'Bendigo',
    'Eaglehawk',
    'Dingee',
    'Pyramid',
    'Kerang',
    'Swan Hill'
  ],
  Warrnambool: [
    'Southern Cross',
    'Ardeer',
    'Deer Park',
    'Tarneit',
    'Wyndham Vale',
    'Little River',
    'Lara',
    'Corio',
    'North Shore',
    'North Geelong',
    'Geelong',
    'South Geelong',
    'Marshall',
    'Waurn Ponds',
    'Winchelsea',
    'Birregurra',
    'Colac',
    'Camperdown',
    'Terang',
    'Sherwood Park',
    'Warrnambool'
  ],
  Albury: [
    'Southern Cross',
    'Donnybrook',
    'Wallan',
    'Heathcote Junction',
    'Wandong',
    'Kilmore East',
    'Broadford',
    'Tallarook',
    'Seymour',
    'Avenel',
    'Euroa',
    'Violet Town',
    'Benalla',
    'Wangaratta',
    'Springhurst',
    'Chiltern',
    'Wodonga',
    'Albury'
  ]
}

function getLineStops(lineName, destination) {
  if (['Traralgon', 'Bairnsdale'].includes(lineName)) return lines.Gippsland
  if (['Seymour', 'Shepparton'].includes(lineName)) return lines.Shepparton
  if (lineName === 'Albury') return lines.Albury
  if (lineName === 'Maryborough') return lines.Maryborough
  if (['Ballarat', 'Ararat'].includes(lineName)) return lines.Ararat
  if (['Geelong', 'Warrnambool'].includes(lineName)) return lines.Warrnambool
  if (['Sunbury', 'Bendigo', 'Echuca'].includes(lineName)) return lines.Echuca
  if (lineName === 'Swan Hill') return lines['Swan Hill']
}

module.exports = getLineStops
