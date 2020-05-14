const fs = require('fs')
const path = require('path')
const async = require('async')
const DatabaseConnection = require('../database/DatabaseConnection')
const config = require('../config.json')
const ptvAPI = require('../ptv-api')
const utils = require('../utils')
const loopDirections = require('../additional-data/loop-direction')
const moment = require('moment')

const database = new DatabaseConnection(config.databaseURL, config.databaseName)
const updateStats = require('./utils/stats')

database.connect({
  poolSize: 100
}, async err => {
  let routes = database.getCollection('routes')
  let updated = 0
  let operationDateCount = 0

  let singleDirection = await routes.findDocuments({
    mode: 'bus',
    'directions.1': { $exists: false },
  }).toArray()

  let loopServices = singleDirection.filter(route => {
    let {stops} = route.directions[0]
    return stops[0].stopName === stops.slice(-1)[0].stopName
  })

  async function update(routeGTFSID, routeName) {
    updated++
    return await routes.updateDocument({ routeGTFSID }, {
      $set: { routeName, codedName: utils.encodeName(routeName) }
    })
  }

  await async.forEach(loopServices, async loopService => {
    let {routeName} = loopService

    routeName = routeName.replace(' Circle', '')
    if (routeName.includes('Town')) {
      let newRouteName = routeName.replace(/Town \w+/, 'Town Service')
      return await update(loopService.routeGTFSID, newRouteName)
    }
    if (routeName.replace(/\(.+$/, '').includes('Loop')) return

    if (loopService.routeGTFSID === '11-SKl') { // hotel shuttle
      return
    }
    if (routeName.includes('Flexiride')) return

    let currentNameParts = routeName.replace(" - Demand Responsive", '').replace(/ Railway Station/g, '').replace(/\(.+\)/, '').split(' - ')

    let loopDirection = loopService.flags ? loopService.flags[0] : ''
    let postfix = `Loop ${loopDirection ? `(${loopDirection})` : 'Service'}`

    if (currentNameParts.length === 1) {
      let name = currentNameParts[0]
      let origin = name
      for (let direction of ['North', 'South', 'East', 'West']) {
        origin = origin.replace(direction, '').trim()
      }
      if (origin !== name) {
        return await update(loopService.routeGTFSID, `${origin} - ${name} ${postfix}`)
      } else {
        return await update(loopService.routeGTFSID, `${origin} ${postfix}`)
      }
    }

    if (currentNameParts.length === 2) {
      let first = currentNameParts[0].trim()
      let last = currentNameParts.slice(-1)[0].trim()
      if (first === last) {
        return await update(loopService.routeGTFSID, first + ` ${postfix}`)
      } else {
        if (['North', 'South', 'East', 'West'].includes(last)) last = `${first} ${last}`
        return await update(loopService.routeGTFSID, `${first} - ${last} ${postfix}`)
      }
    }

    return await update(loopService.routeGTFSID, `${currentNameParts[0]} - ${currentNameParts[1]} ${postfix}`)
  })

  let ptvRoutes = (await ptvAPI('/v3/routes?route_types=2')).routes
  await async.forEach(ptvRoutes, async route => {
    let routeGTFSID = route.route_gtfs_id, routeName = route.route_name
    let now = utils.now()

    if (routeName.includes('(From') || routeName.includes('(Until') || routeName.includes('(Discontinued')) {
      let parts = routeName.match(/\((Until|From|Discontinued from) (\d{1,2}-\d{1,2}-\d{1,4})\)/)
      let type = parts[1], date = parts[2]
      if (type === 'Discontinued from') type = 'until'
      else type = type.toLowerCase()

      let dateMoment = moment.tz(date, 'DD-MM-YYYY', 'Australia/Melbourne')
      if (dateMoment > now) {
        operationDateCount++
        await routes.updateDocument({ routeGTFSID }, {
          $set: {
            operationDate: {
              type,
              operationDate: dateMoment.toDate(),
              operationDateReadable: date
            }
          }
        })
      }
    }
  })

  await updateStats('bus-route-names', updated)
  console.log('Completed loading in ' + updated + ' bus route names')
  console.log('Completed loading in ' + operationDateCount + ' bus operation dates')
  process.exit(0)
})
