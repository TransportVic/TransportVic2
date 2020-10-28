const express = require('express')
const router = new express.Router()
const async = require('async')
const safeRegex = require('safe-regex')
const utils = require('../../utils')
const natural = require('natural')
const metaphone = natural.Metaphone

router.get('/', (req, res) => {
  res.render('search/index', { placeholder: 'Station, stop or route' })
})

async function prioritySearch(db, query) {
  let stops = db.getCollection('stops')

  let possibleStopNames = [
    query,
    utils.adjustStopName(utils.titleCase(query, true).replace('Sc', 'Shopping Centre'))
  ]

  let fullQuery = possibleStopNames.join(' ')

  let priorityStopsByName = (await stops.findDocuments({
    $and: [{
      $text: {
        $search: fullQuery
      }
    }, {
      $or: possibleStopNames.map(name => ({mergeName: new RegExp(name, 'i')}))
    }, {
      $or: [{
        mergeName: /Shopping Centre/
      }, {
        mergeName: /Railway Station/
      }, {
        mergeName: /University/
      }]
    }]
  }).limit(6).toArray()).sort((a, b) => a.stopName.length - b.stopName.length)

  let nquery = query.match(/^\d+$/) ? parseInt(query) : -1
  let gtfsMatch = await stops.findDocuments({
    'bays.stopGTFSID': nquery
  }).toArray()

  let numericalMatchStops = (await stops.findDocuments({
    $or: [{
      'bays.tramTrackerID': query
    }, {
      'bays.stopNumber': query.replace('#', '').toUpperCase()
    }]
  }).toArray()).sort((a, b) => a.stopName.length - b.stopName.length)

  return gtfsMatch.concat(numericalMatchStops).concat(priorityStopsByName)
}

async function findStops(db, query) {
  let stops = db.getCollection('stops')

  let prioritySearchResults = await prioritySearch(db, query)
  let excludedIDs = prioritySearchResults.map(stop => stop._id)

  let search = utils.adjustStopName(utils.titleCase(query, true).replace('Sc', 'Shopping Centre'))
  let queryRegex = new RegExp(query, 'i')
  let searchRegex = new RegExp(search, 'i')
  let stationRegex = new RegExp(query.replace(/sta?t?i?o?n?/i, 'railway station'), 'i')

  let phoneticQuery = metaphone.process(query)

  let remainingResults = (await stops.findDocuments({
    _id: {
      $not: {
        $in: excludedIDs
      }
    },
    $and: [{
      $text: {
        $search: query + ' ' + search
      }
    }, {
      $or: [{
        suburb: queryRegex
      }, {
        stopName: queryRegex
      }, {
        stopName: searchRegex
      }, {
        stopName: stationRegex
      }]
    }]
  }).limit(15 - prioritySearchResults.length).toArray()).sort((a, b) => a.stopName.length - b.stopName.length)

  let lowPriorityResults = await stops.findDocuments({
    _id: {
      $not: {
        $in: excludedIDs.concat(remainingResults.map(stop => stop._id))
      }
    },
    $and: [{
      $text: {
        $search: query + ' ' + search
      }
    }, {
      $or: [{
        'bays.fullStopName': queryRegex
      }, {
        'bays.originalName': queryRegex
      }, {
        'bays.fullStopName': searchRegex
      }, {
        'tramTrackerNames': searchRegex
      }, {
        'tramTrackerNames': queryRegex
      }]
    }]
  }).limit(15 - prioritySearchResults.length - remainingResults.length).toArray()

  let currentResults = prioritySearchResults.concat(remainingResults).concat(lowPriorityResults)

  let phoneticMatch = await stops.findDocuments({
    _id: {
      $not: {
        $in: currentResults.map(stop => stop._id)
      }
    },
    namePhonetic: phoneticQuery
  }).limit(5).toArray()

  return currentResults.concat(phoneticMatch)
}

async function findRoutes(db, query) {
  query = query.replace(/li?n?e?/, '').trim()
  let queryRegex = new RegExp(query, 'i')

  let routes = (await db.getCollection('routes').findDocuments({
    $or: [{
      routeNumber: queryRegex
    }, {
      routeName: queryRegex
    }]
  }).limit(15).toArray()).sort((a, b) => a.routeNumber - b.routeNumber || a.routeName.localeCompare(b.routeName))

  return routes
}

router.post('/', async (req, res) => {
  let query = req.body.query.trim()
  if (!safeRegex(query) || query === '') {
    return res.end('')
  }

  const stops = await findStops(res.db, query)
  const routes = await findRoutes(res.db, query)

  res.render('search/results', {stops, routes, encodeName: utils.encodeName})
})

module.exports = router
