#! /usr/bin/env node

const config = require('../config')
const DatabaseConnection = require('../database/DatabaseConnection')
const utils = require('../utils')
const async = require('async')
const fs = require('fs')
const path = require('path')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const regional = require('../additional-data/bus-data/regional-with-track.json')

database.connect(async () => {
  let routes = database.getCollection('routes')
  let busRoutes = await routes.findDocuments({
    mode: 'bus',
    $and: [{
      routeGTFSID: /^6-/,
    }, {
      routeGTFSID: {
        $not: {
          $in: Object.values(regional).map(r => r.map(z => z.routeGTFSID)).reduce((a, e) => a.concat(e), [])}
        }
      }]
    }).toArray()

  busRoutes = busRoutes.map(route => {
    let stops = route.directions[0].stops
    let originStop = stops[0]
    let destinationStop = stops[stops.length - 1]

    let origin = originStop.suburb.replace(/, .+/, '')
    let destination = destinationStop.suburb.replace(/, .+/, '')

    if (origin === 'Wodonga') origin = 'Albury'
    if (destination === 'Wodonga') destination = 'Albury'

    if (origin === destination) {
      let otherSuburbStops = stops.filter(stop => stop.suburb !== originStop.suburb)
      let centreStop = otherSuburbStops[Math.floor(otherSuburbStops.length / 2)]
      if (centreStop) {
        destination = centreStop.suburb.replace(/, .+/, '')
      }
    }

    route.routeName = route.routeName.replace('Koo - Wee - Rup', 'Koo Wee Rup').split(' - ').sort((a, b) => a.localeCompare(b)).join(' - ')

    route.routeNameTest = [origin, destination].sort((a, b) => a.localeCompare(b)).join(' - ')
    
    if (origin === destination) {
      if ([originStop.stopName, destinationStop.stopName].includes('Hopkins Correctional Centre/Warrak Road')) {
        route.routeNameTest = 'Ararat - Ararat Prison'
      } else if (originStop.suburb === 'Wonthaggi') {
        route.routeNameTest = `Wonthaggi - Wonthaggi ${route.routeNumber}`
      } else {
        route.routeNameTest = origin + ' Town Service'
      }
    }

    if (route.routeNumber === 'Dudley') route.routeNameTest = 'Wonthaggi - Dudley'
    if (route.routeNumber === 'South - Schools AM') route.routeNameTest = 'Swan Hill Schools - AM'
    if (route.routeNumber === 'South - Schools PM') route.routeNameTest = 'Swan Hill Schools - PM'

    route.routeNameTest = route.routeNameTest
      .replace('Ballarat Central', 'Ballarat')
      .replace('Wendouree', 'Ballarat')
      .replace('Narre Warren', 'Fountain Gate')
      .replace('Ventnor', 'Cowes')

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
    if (routes[0].routeGTFSID.startsWith('6-w')) return

    routes.forEach(route => {
      let stops = route.directions[0].stops
      let originStop = stops[0]
      let destinationStop = stops[stops.length - 1]
      let otherSuburbStops = stops.filter(stop => stop.suburb !== originStop.suburb && stop.suburb !== destinationStop.suburb)
      let centreStop = otherSuburbStops[Math.floor(otherSuburbStops.length / 2)]

      if (centreStop) {
        let via = ` via ${centreStop.suburb.replace(/, .+/, '')}`
        // console.log(route.routeGTFSID, name, centreStop)
        route.routeNameTest += via
      } else {
        console.log(name)
      }
    })
  })

  busRoutes.forEach(route => console.log(`${route.routeGTFSID}\t${route.routeNumber}\t${route.routeNameTest}\t${route.operators.join('\t')}`))

  // console.log(duplicateNames)

  process.exit(0)
  // console.log(busRoutes)
})

// 6-960    Mulwala - Wangaratta        Wangaratta - Yarrawonga
// 6-a29    Ballarat - Maryborough        Ballarat - Bendigo ok thats school extension
// 6-a34    Cowes - Narre Warren        Cowes - Fountain Gate
// 6-rok    Rokewood - Wendouree        Ballarat - Rokewood done

