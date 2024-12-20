let lines = {
  Gippsland: [
    'Richmond',
    'South Yarra',
    'Hawksburn',
    'Toorak',
    'Armadale',
    'Malvern',
    'Caulfield',
    'Carnegie',
    'Murrumbeena',
    'Hughesdale',
    'Oakleigh',
    'Huntingdale',
    'Clayton',
    'Westall',
    'Springvale',
    'Sandown Park',
    'Noble Park',
    'Yarraman',
    'Dandenong',
    'Hallam',
    'Narre Warren',
    'Berwick',
    'Beaconsfield',
    'Officer',
    'Cardinia Road',
    'Pakenham',
    'East Pakenham',
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
  Upfield: [
    'North Melbourne',
    'Macaulay',
    'Flemington Bridge',
    'Royal Park',
    'Jewell',
    'Brunswick',
    'Anstey',
    'Moreland',
    'Coburg',
    'Batman',
    'Merlynston',
    'Fawkner',
    'Gowrie',
    'Upfield'
  ],
  Cranbourne: [
    'Richmond',
    'South Yarra',
    'Hawksburn',
    'Toorak',
    'Armadale',
    'Malvern',
    'Caulfield',
    'Carnegie',
    'Murrumbeena',
    'Hughesdale',
    'Oakleigh',
    'Huntingdale',
    'Clayton',
    'Westall',
    'Springvale',
    'Sandown Park',
    'Noble Park',
    'Yarraman',
    'Dandenong',
    'Lynbrook',
    'Merinda Park',
    'Cranbourne',
  ],
  'Stony Point': [
    'Richmond',
    'South Yarra',
    'Hawksburn',
    'Toorak',
    'Armadale',
    'Malvern',
    'Caulfield',
    'Glen Huntly',
    'Ormond',
    'McKinnon',
    'Bentleigh',
    'Patterson',
    'Moorabbin',
    'Highett',
    'Southland',
    'Cheltenham',
    'Mentone',
    'Parkdale',
    'Mordialloc',
    'Aspendale',
    'Edithvale',
    'Chelsea',
    'Bonbeach',
    'Carrum',
    'Seaford',
    'Kananook',
    'Frankston',
    'Leawarra',
    'Baxter',
    'Somerville',
    'Tyabb',
    'Hastings',
    'Bittern',
    'Morradoo',
    'Crib Point',
    'Stony Point'
  ],
  Sandringham: [
    'Richmond',
    'South Yarra',
    'Prahran',
    'Windsor',
    'Balaclava',
    'Ripponlea',
    'Elsternwick',
    'Gardenvale',
    'North Brighton',
    'Middle Brighton',
    'Brighton Beach',
    'Hampton',
    'Sandringham'
  ],
  Williamstown: [
    'North Melbourne',
    'South Kensington',
    'Footscray',
    'Seddon',
    'Yarraville',
    'Spotswood',
    'Newport',
    'North Williamstown',
    'Williamstown Beach',
    'Williamstown'
  ],
  Werribee: [ // We can use this for GLG trains routed via WER
    'North Melbourne',
    'South Kensington',
    'Footscray',
    'Seddon',
    'Yarraville',
    'Spotswood',
    'Newport',
    'Seaholme',
    'Altona',
    'Westona',
    'Paisley',
    'Galvin',
    'Laverton',
    'Aircraft',
    'Williams Landing',
    'Hoppers Crossing',
    'Werribee',
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
  Shepparton: [
    'North Melbourne',
    'Kensington',
    'Newmarket',
    'Ascot Vale',
    'Moonee Ponds',
    'Essendon',
    'Glenbervie',
    'Strathmore',
    'Pascoe Vale',
    'Oak Park',
    'Glenroy',
    'Jacana',
    'Broadmeadows',
    'Coolaroo',
    'Roxburgh Park',
    'Craigieburn',
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
    'Footscray',
    'Sunshine',
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
    'Ballarat',
    'Creswick',
    'Clunes',
    'Talbot',
    'Maryborough',
  ],
  Belgrave: [
    'Richmond',
    'East Richmond',
    'Burnley',
    'Hawthorn',
    'Glenferrie',
    'Auburn',
    'Camberwell',
    'East Camberwell',
    'Canterbury',
    'Chatham',
    'Union',
    'Box Hill',
    'Laburnum',
    'Blackburn',
    'Nunawading',
    'Mitcham',
    'Heatherdale',
    'Ringwood',
    'Heathmont',
    'Bayswater',
    'Boronia',
    'Ferntree Gully',
    'Upper Ferntree Gully',
    'Upwey',
    'Tecoma',
    'Belgrave'
  ],
  Lilydale: [
    'Richmond',
    'East Richmond',
    'Burnley',
    'Hawthorn',
    'Glenferrie',
    'Auburn',
    'Camberwell',
    'East Camberwell',
    'Canterbury',
    'Chatham',
    'Union',
    'Box Hill',
    'Laburnum',
    'Blackburn',
    'Nunawading',
    'Mitcham',
    'Heatherdale',
    'Ringwood',
    'Ringwood East',
    'Croydon',
    'Mooroolbark',
    'Lilydale'
  ],
  Sunbury: [
    'North Melbourne',
    'South Kensington',
    'Footscray',
    'Middle Footscray',
    'West Footscray',
    'Tottenham',
    'Sunshine',
    'Albion',
    'Ginifer',
    'St. Albans',
    'Keilor Plains',
    'Watergardens',
    'Diggers Rest',
    'Sunbury',
  ],
  Echuca: [
    'Footscray',
    'Sunshine',
    'Albion',
    'Ginifer',
    'St. Albans',
    'Keilor Plains',
    'Watergardens',
    'Diggers Rest',
    'Sunbury',
    'Clarkefield',
    'Riddells Creek',
    'Gisborne',
    'Macedon',
    'Woodend',
    'Kyneton',
    'Malmsbury',
    'Castlemaine',
    // 'Harcourt',
    'Kangaroo Flat',
    'Bendigo',
    'Epsom',
    'Huntly',
    'Goornong',
    'Elmore',
    'Rochester',
    'Echuca'
  ],

  'Swan Hill': [
    'Footscray',
    'Sunshine',
    'Albion',
    'Ginifer',
    'St. Albans',
    'Keilor Plains',
    'Watergardens',
    'Diggers Rest',
    'Sunbury',
    'Clarkefield',
    'Riddells Creek',
    'Gisborne',
    'Macedon',
    'Woodend',
    'Kyneton',
    'Malmsbury',
    'Castlemaine',
    // 'Harcourt',
    'Kangaroo Flat',
    'Bendigo',
    'Eaglehawk',
    'Raywood',
    'Dingee',
    'Pyramid',
    'Kerang',
    'Swan Hill'
  ],
  Warrnambool: [
    'Footscray',
    'Sunshine',
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
  Alamein: [
    'Richmond',
    'East Richmond',
    'Burnley',
    'Hawthorn',
    'Glenferrie',
    'Auburn',
    'Camberwell',
    'Riversdale',
    'Willison',
    'Hartwell',
    'Burwood',
    'Ashburton',
    'Alamein'
  ],
  Albury: [
    'Southern Cross',
    'North Melbourne',
    'Kensington',
    'Newmarket',
    'Ascot Vale',
    'Moonee Ponds',
    'Essendon',
    'Glenbervie',
    'Strathmore',
    'Pascoe Vale',
    'Oak Park',
    'Glenroy',
    'Jacana',
    'Broadmeadows',
    'Coolaroo',
    'Roxburgh Park',
    'Craigieburn',
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
  ],
  Mernda: [
    'Jolimont',
    'West Richmond',
    'North Richmond',
    'Collingwood',
    'Victoria Park',
    'Clifton Hill',
    'Rushall',
    'Merri',
    'Northcote',
    'Croxton',
    'Thornbury',
    'Bell',
    'Preston',
    'Regent',
    'Reservoir',
    'Ruthven',
    'Keon Park',
    'Thomastown',
    'Lalor',
    'Epping',
    'South Morang',
    'Middle Gorge',
    'Hawkstowe',
    'Mernda'
  ],
  Hurstbridge: [
    'Jolimont',
    'West Richmond',
    'North Richmond',
    'Collingwood',
    'Victoria Park',
    'Clifton Hill',
    'Westgarth',
    'Dennis',
    'Fairfield',
    'Alphington',
    'Darebin',
    'Ivanhoe',
    'Eaglemont',
    'Heidelberg',
    'Rosanna',
    'Macleod',
    'Watsonia',
    'Greensborough',
    'Montmorency',
    'Eltham',
    'Diamond Creek',
    'Wattle Glen',
    'Hurstbridge'
  ],
  'Glen Waverley': [
    'Richmond',
    'East Richmond',
    'Burnley',
    'Heyington',
    'Kooyong',
    'Tooronga',
    'Gardiner',
    'Glen Iris',
    'Darling',
    'East Malvern',
    'Holmesglen',
    'Jordanville',
    'Mount Waverley',
    'Syndal',
    'Glen Waverley'
  ],
  'City Circle': [
    'Parliament',
    'Melbourne Central',
    'Flagstaff',
    'Southern Cross',
    'Flinders Street',
    'Southern Cross',
    'Flagstaff',
    'Melbourne Central',
    'Parliament'
  ],
  'Sydney': [
    'Southern Cross',
    'Broadmeadows',
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
    'Albury',
    'Culcairn',
    'Henty',
    'The Rock',
    'Wagga Wagga',
    'Junee',
    'Cootamundra',
    'Harden',
    'Yass Junction',
    'Gunning',
    'Goulburn',
    'Moss Vale',
    'Campbelltown',
    'Sydney Central'
  ],
  'Flemington Racecourse': [
    'North Melbourne',
    'Kensington',
    'Newmarket',
    'Showgrounds',
    'Flemington Racecourse'
  ],
  Overland: [
    "Southern Cross",
    "North Shore",
    "Ararat",
    "Stawell",
    "Horsham",
    "Dimboola",
    "Nhill",
    "Bordertown",
    "Murray Bridge",
    "Adelaide"
  ]
}

function getLineStops(lineName, destination) {
  if (['Pakenham', 'Traralgon', 'Bairnsdale'].includes(lineName)) return lines.Gippsland
  if (lineName === 'Cranbourne') return lines.Cranbourne
  if (lineName === 'Belgrave') return lines.Belgrave
  if (lineName === 'Lilydale') return lines.Lilydale
  if (lineName === 'Alamein') return lines.Alamein
  if (['Craigieburn', 'Seymour', 'Shepparton'].includes(lineName)) return lines.Shepparton
  if (lineName === 'Albury') return lines.Albury
  if (lineName === 'Maryborough') return lines.Maryborough
  if (['Ballarat', 'Ararat'].includes(lineName)) return lines.Ararat
  if (['Geelong', 'Warrnambool'].includes(lineName)) return lines.Warrnambool
  if (lineName === 'Werribee') return lines.Werribee
  if (lineName === 'Williamstown') return lines.Williamstown
  if (lineName === 'Sandringham') return lines.Sandringham
  if (lineName === 'Upfield') return lines.Upfield
  if (['Frankston', 'Stony Point'].includes(lineName)) return lines['Stony Point']
  if (lineName === 'Sunbury') return lines.Sunbury
  if (['Bendigo', 'Echuca'].includes(lineName)) return lines.Echuca
  if (lineName === 'Swan Hill') return lines['Swan Hill']
  if (lineName === 'Glen Waverley') return lines['Glen Waverley']
  if (lineName === 'Mernda') return lines.Mernda
  if (lineName === 'Hurstbridge') return lines.Hurstbridge
  if (lineName === 'City Circle') return lines['City Circle']
  if (lineName === 'Sydney - Melbourne') return lines.Sydney
  if (lineName === 'Flemington Racecourse') return lines['Flemington Racecourse']
  if (lineName === 'The Overland') return lines.Overland
}

module.exports = getLineStops
