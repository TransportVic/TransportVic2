const express = require('express')
const router = new express.Router()
const async = require('async')
const safeRegex = require('safe-regex')
const utils = require('../../utils')

router.get('/', (req, res) => {
  res.render('search/index', { placeholder: 'Station, stop or route' })
})

async function prioritySearch(db, query) {
  let possibleStopNames = [
    query,
    utils.adjustStopname(utils.titleCase(query, true).replace('Sc', 'Shopping Centre'))
  ]

  let search = possibleStopNames.map(name => ({mergeName: new RegExp(name, 'i')}))

  let priorityStopsByName = (await db.getCollection('stops').findDocuments({
    $or: search
  }).toArray()).filter(stop => {
    return stop.mergeName.includes('Shopping Centre') || stop.mergeName.includes('Railway Station')
      || stop.mergeName.includes('University')
  }).sort((a, b) => a.stopName.length - b.stopName.length)
  let nquery = query.match(/^\d+$/) ? parseInt(query) : -1
  let gtfsMatch = await db.getCollection('stops').findDocuments({
    'bays.stopGTFSID': nquery
  }).toArray()

  let numericalMatchStops = (await db.getCollection('stops').findDocuments({
    $or: [{
      tramTrackerIDs: nquery
    }, {
      'bays.stopNumber': query.replace('#', '')
    }]
  }).toArray()).sort((a, b) => a.stopName.length - b.stopName.length)

  return gtfsMatch.concat(numericalMatchStops).concat(priorityStopsByName)
}

async function findStops(db, query) {
  let search

  let prioritySearchResults = await prioritySearch(db, query)
  let excludedIDs = prioritySearchResults.map(stop => stop._id)

  let queryRegex = new RegExp(query, 'i')
  let searchRegex = new RegExp(utils.adjustStopname(utils.titleCase(query, true).replace('Sc', 'Shopping Centre')), 'i')

  let remainingResults = (await db.getCollection('stops').findDocuments({
    _id: {
      $not: {
        $in: excludedIDs
      }
    },
    $or: [{
      suburb: queryRegex
    }, {
      stopName: queryRegex
    }, {
      stopName: searchRegex
    }]
  }).limit(15 - prioritySearchResults.length).toArray()).sort((a, b) => a.stopName.length - b.stopName.length)

  let lowPriorityResults = await db.getCollection('stops').findDocuments({
    _id: {
      $not: {
        $in: excludedIDs.concat(remainingResults.map(stop => stop._id))
      }
    },
    $or: [{
      'bays.fullStopName': queryRegex
    }, {
      'bays.originalStopName': queryRegex
    }, {
      'bays.fullStopName': searchRegex
    }, {
      'tramTrackerNames': searchRegex
    }, {
      'tramTrackerNames': queryRegex
    }]
  }).limit(15 - prioritySearchResults.length - remainingResults.length).toArray()

  return prioritySearchResults.concat(remainingResults).concat(lowPriorityResults)
}

async function findRoutes(db, query) {
  let queryRegex = new RegExp(query, 'i')
  
  let routes = (await db.getCollection('routes').findDocuments({
    $or: [{
      routeNumber: queryRegex
    }, {
      routeName: queryRegex
    }]
  }).limit(5).toArray())

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
