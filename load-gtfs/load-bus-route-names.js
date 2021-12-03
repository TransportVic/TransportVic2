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

async function deleteRoute(routeGTFSID, gtfsTimetables, routes) {
  await Promise.all([
    routes.deleteDocument({ routeGTFSID }),
    gtfsTimetables.deleteDocuments({ routeGTFSID })
  ])

  console.log('Deleted route ' + routeGTFSID + ' as it was past the until date')
}

database.connect({
  poolSize: 100
}, async err => {
  let routes = database.getCollection('routes')
  let gtfsTimetables = database.getCollection('gtfs timetables')
  let updated = 0
  let operationDateCount = 0

  async function update(routeGTFSID, routeName) {
    updated++
    return await routes.updateDocument({ routeGTFSID }, {
      $set: { routeName, codedName: utils.encodeName(routeName) }
    })
  }

  let ptvRoutes = (await ptvAPI('/v3/routes?route_types=2', 6, 12000)).routes
  await async.forEach(ptvRoutes, async route => {
    if (!route.route_number) return
    let routeName = route.route_name.replace(/effective /i, '').toLowerCase()

    if (routeName.includes('(from') || routeName.includes('(until') || routeName.includes('(discontinued')) {
      let now = utils.now().startOf('day')

      let parts = routeName.match(/\((until|from|discontinued) (\d{1,2}-\d{1,2}-\d{1,4})\)/)
      if (!parts) {
        parts = routeName.match(/\((until|from|discontinued) (\d{1,2} \w* \d{1,4})\)/)
      }

      let type = parts[1], date = parts[2]
      if (type.includes('discontinued')) type = 'until'
      else type = type

      let formats = ['DD-MM-YYYY', 'DD MMMM YYYY']
      let dateMoment
      for (let format of formats) {
        dateMoment = utils.parseTime(date, format)
        if (dateMoment.isValid()) break
      }

      let possibleRouteGTFSIDs = await routes.distinct('routeGTFSID', {
        mode: 'bus',
        routeNumber: route.route_number
      })

      let endpointDates = [utils.getYYYYMMDD(dateMoment)]
      let dayOfWeek = utils.getDayOfWeek(dateMoment)
      if (dayOfWeek === 'Sat' || dayOfWeek === 'Sun') {
        if (type === 'until') { // If until date is a sunday match the saturday and friday (or thursday)
          endpointDates.push(utils.getYYYYMMDD(dateMoment.clone().add(-1, 'day')))
          endpointDates.push(utils.getYYYYMMDD(dateMoment.clone().add(-2, 'day')))
        } else { // If from date is a saturday match the sunday and monday (unlikely to have Sunday only though)
          endpointDates.push(utils.getYYYYMMDD(dateMoment.clone().add(1, 'day')))
          endpointDates.push(utils.getYYYYMMDD(dateMoment.clone().add(2, 'day')))
        }
      }

      let routeGTFSID = (await async.find(possibleRouteGTFSIDs, async possibleRouteGTFSID => {
        let operationDays = await gtfsTimetables.distinct('operationDays', {
          mode: 'bus',
          routeGTFSID: possibleRouteGTFSID
        })

        if (type === 'from' && endpointDates.includes(operationDays[0])) return true
        if (type === 'until' && endpointDates.includes(operationDays[operationDays.length - 1])) return true
        return false
      }))

      if (!routeGTFSID) console.log('Could not match route', route)

      // if (dateMoment >= now) {
        operationDateCount++
        await routes.updateDocument({ routeGTFSID }, {
          $set: {
            operationDate: {
              type,
              operationDate: dateMoment.toDate(),
              operationDateReadable: dateMoment.format('DD-MM-YYYY')
            }
          }
        })
      // } else {
      //   if (type === 'until') {
      //     // await deleteRoute(routeGTFSID, gtfsTimetables, routes)
      //   }
      // }
    }
  })

  await updateStats('bus-route-names', updated)
  console.log('Completed loading in ' + updated + ' bus route names')
  console.log('Completed loading in ' + operationDateCount + ' bus operation dates')
  process.exit(0)
})
