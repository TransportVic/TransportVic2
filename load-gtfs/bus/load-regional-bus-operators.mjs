import config from '../../config.json' with { type: 'json' }
import { MongoDatabaseConnection } from '@transportme/database'
import regional from '../../additional-data/bus-data/bus-network-regions.json' with { type: 'json' }
import operators from '../../transportvic-data/excel/bus/operators/regional-inter-town-operators.json' with { type: 'json' }

const database = new MongoDatabaseConnection(config.databaseURL, config.databaseName)

function changeName(name) {
  if (name === 'Ballarat Central') return 'Ballarat'
  if (name === 'Wendouree') return 'Ballarat'
  if (name === 'Narre Warren') return 'Fountain Gate'
  if (name === 'Ventnor') return 'Cowes'
  if (name === 'Wodonga') return 'Albury'
  if (name === 'Tawonga South') return 'Mount Beauty'
  if (name === 'Corinella') return 'Coronet Bay'
  if (name === 'Cheshunt') return 'King Valley'

  return name
}

await database.connect({})
let routes = database.getCollection('gtfs-routes')
let busRoutes = await routes.findDocuments({
  mode: 'bus',
  operators: 'Unknown',
  $and: [{
    routeGTFSID: /^[46]-/,
  }, {
    routeGTFSID: {
      $not: {
        $in: Object.values(regional).map(r => r.map(z => z.routeGTFSID)).reduce((a, e) => a.concat(e), [])
      }
    }
  }]
}).toArray()

busRoutes = busRoutes.map(route => {
  if (!route.directions[0]) {
    console.log('Route', route.routeGTFSID, route.routeNumber, route.routeName, 'has no directions!')
    return route
  }

  let stops = route.directions[0].stops
  let originStop = stops[0]
  let destinationStop = stops[stops.length - 1]

  let origin = changeName(originStop.suburb.replace(/, .+/, '').replace(/ \([A-Z]+\)$/, ''))
  let destination = changeName(destinationStop.suburb.replace(/, .+/, '').replace(/ \([A-Z]+\)$/, ''))

  if (origin === destination) {
    let otherSuburbStops = stops.filter(stop => stop.suburb !== originStop.suburb)
    let centreStop = otherSuburbStops[Math.floor(otherSuburbStops.length / 2)]
    if (centreStop) {
      destination = changeName(centreStop.suburb.replace(/, .+/, '').replace(/ \([A-Z]+\)$/, ''))
    }
  }

  if ([origin, destination].includes('North Wonthaggi')) {
    let hasDudley = route.directions[0].stops.some(stop => stop.suburb.includes('Dudley'))
    if (hasDudley) {
      origin = 'Wonthaggi'
      destination = 'Dudley'
    }
  }

  route.routeName = route.routeName.replace('Koo - Wee - Rup', 'Koo Wee Rup').split(' - ').sort((a, b) => a.localeCompare(b)).join(' - ')
  route.routeNameTest = [origin, destination].sort((a, b) => a.localeCompare(b)).join(' - ')

  if (origin === destination) {
    if ([originStop.stopName, destinationStop.stopName].includes('Hopkins Correctional Centre/Warrak Road')) {
      route.routeNameTest = 'Ararat - Ararat Prison'
    } else if (originStop.suburb === 'Wonthaggi') {
      let direction = route.routeName.includes('North') ? 'North' : 'South'
      route.routeNameTest = `${direction} Wonthaggi - Wonthaggi`
    } else {
      route.routeNameTest = origin + ' Town Service'
    }
  }

  if (route.routeGTFSID === '4-WGT') route.routeNameTest = 'West Gippsland Transit'
  if (route.routeNumber === 'South - Schools AM') route.routeNameTest = 'Swan Hill Schools - AM'
  if (route.routeNumber === 'South - Schools PM') route.routeNameTest = 'Swan Hill Schools - PM'
  if (route.routeNameTest == 'Mulwala - Yarrawonga') route.routeNameTest = 'Mulwala & Yarrawonga Flexiride'

  return route
})

let uniqueNames = []
let duplicateNames = []
busRoutes.forEach(route => {
  if (!uniqueNames.includes(route.routeNameTest)) {
    uniqueNames.push(route.routeNameTest)
  } else {
    duplicateNames.push(route.routeNameTest)
  }
})

duplicateNames.forEach(name => {
  let routes = busRoutes.filter(z => z.routeNameTest === name)
  if (!routes.length || routes[0].routeGTFSID.startsWith('6-w')) return

  routes.forEach(route => {
    if (!route.directions[0]) return

    let stops = route.directions[0].stops
    let originStop = stops[0]
    let destinationStop = stops[stops.length - 1]
    let otherSuburbStops = stops.filter(stop => stop.suburb !== originStop.suburb && stop.suburb !== destinationStop.suburb)
    let centreStop = otherSuburbStops[Math.floor(otherSuburbStops.length / 2)]

    if (centreStop) {
      let via = ` via ${centreStop.suburb.replace(/, .+/, '').replace(/ \([A-Z]+\)$/, '')}`
      // console.log(route.routeGTFSID, name, centreStop)
      route.routeNameTest += via
    } else {
      console.log(name)
    }
  })
})

for (let route of busRoutes) {
  let operator = operators[route.routeNameTest]
  if (!operator) {
    console.log('Failed to map operator', route.routeNameTest, ':', route.routeName, route.routeGTFSID)
    operator = 'Unknown'
  }

  await routes.updateDocument({ routeGTFSID: route.routeGTFSID }, {
    $set: {
      routeName: route.routeNameTest,
      operators: [ operator ],
      routeNumber: null
    }
  })
}

// console.table(busRoutes.map(route => ({ routeGTFSID: route.routeGTFSID, routeNumber: route.routeNumber, routeName: route.routeNameTest, originalRouteName: route.routeName })))
// console.log(duplicateNames)
// console.log(busRoutes)

process.exit(0)

// 6-960    Mulwala - Wangaratta        Wangaratta - Yarrawonga
// 6-a29    Ballarat - Maryborough        Ballarat - Bendigo ok thats school extension
// 6-a34    Cowes - Narre Warren        Cowes - Fountain Gate
// 6-rok    Rokewood - Wendouree        Ballarat - Rokewood done

