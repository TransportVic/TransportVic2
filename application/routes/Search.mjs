import express from 'express'
import escapeRegex from 'escape-regex-string'
import utils from '../../utils.js'
import stationCodes from '../../additional-data/station-codes.json' with { type: 'json' }

const router = new express.Router()

router.get('/', (req, res) => {
  res.render('search/index', { placeholder: 'Station, stop or route' })
})

async function prioritySearch(db, query) {
  let stops = db.getCollection('stops')

  let possibleStopNames = [
    query,
    utils.adjustStopName(utils.titleCase(query, true).replace('Sc', 'Shopping Centre'))
  ].map(name => name.toLowerCase()).filter((e, i, a) => a.indexOf(e) === i)

  if (stationCodes[query.toUpperCase()]) {
    return await stops.findDocuments({
      stopName: stationCodes[query.toUpperCase()] + ' Railway Station'
    }).toArray()
  }

  let fullQuery = possibleStopNames.join(' ')

  let priorityStopsByName = (await stops.findDocuments({
    $and: [
      ...(fullQuery.split(/[^\w]/).map(name => ({ textQuery: name }))),
      // {
      //   textQuery: fullQuery
      //   $text: {
      //     $search: fullQuery
      //   }
      // }, {
    {
      $or: possibleStopNames.map(name => ({ mergeName: name }))
    }, {
      $or: [{
        mergeName: /Shopping Centre/
      }, {
        mergeName: /Railway Station/
      }, {
        mergeName: /University/
      }, {
        mergeName: /Town Centre/
      }]
    }]
  }).limit(6).toArray()).sort((a, b) => a.stopName.length - b.stopName.length)

  let gtfsMatch = await stops.findDocuments({
    'bays.stopGTFSID': query
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

  let search = utils.adjustStopName(utils.titleCase(query, true).replace('Sc', 'Shopping Centre')).toLowerCase()
  let queryString = query.toLowerCase()

  let queryRegex = new RegExp(queryString, 'i')
  let searchRegex = new RegExp(search, 'i')
  let stationRegex = new RegExp(queryString.replace(/sta?t?i?o?n?/i, 'railway station'), 'i')

  let remainingResults = (await stops.findDocuments({
    _id: {
      $not: {
        $in: excludedIDs
      }
    },
    $and: [
      ...((queryString + ' ' + search).split(/[^\w]/).map(name => ({ textQuery: name }))),
      // {
      //   $text: {
      //     $search: queryString + ' ' + search
      //   }
      // }, 
    {
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
    $and: [
      ...((queryString + ' ' + search).split(/[^\w]/).map(name => ({ textQuery: name }))),
      // {
      //   $text: {
      //     $search: queryString + ' ' + search
      //   }
      // },
    {
      $or: [{
        'bays.fullStopName': queryRegex
      }, {
        'bays.originalName': queryRegex
      }, {
        'bays.fullStopName': searchRegex
      }, {
        'bays.tramTrackerName': searchRegex
      }, {
        'bays.tramTrackerName': queryRegex
      }]
    }]
  }).limit(15 - prioritySearchResults.length - remainingResults.length).toArray()

  let currentResults = prioritySearchResults.concat(remainingResults).concat(lowPriorityResults)

  return currentResults
}

async function findRoutes(db, query) {
  query = query.replace(/ li?n?e?/, '').trim()
  if (query.length) {
    let queryRegex = new RegExp(query, 'i')

    return (await db.getCollection('routes').findDocuments({
      $or: [{
        routeNumber: queryRegex
      }, {
        routeName: queryRegex
      }, {
        'directions.stops.suburb': queryRegex
      }]
    }).sort({
      routeNumber: 1,
      routeName: 1
    }).limit(15).toArray())
  } else {
    return []
  }
}

router.post('/', async (req, res) => {
  let query = req.body.query.trim()
  query = escapeRegex(query)

  let stops = await findStops(res.db, query)
  let routes = await findRoutes(res.db, query)

  res.render('search/results', {stops, routes, encodeName: utils.encodeName})
})

export default router