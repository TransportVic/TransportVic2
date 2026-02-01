import express from 'express'
import escapeRegex from 'escape-regex-string'
import utils from '../../utils.mjs'
import stationCodes from '../../additional-data/station-codes.json' with { type: 'json' }
import { distance } from 'fastest-levenshtein'

const router = new express.Router()

const addDistance = (arr, query) => arr.map(stop => {
  stop.distance = distance(stop.stopName.toLowerCase(), query.toLowerCase())
  return stop
})

router.get('/', (req, res) => {
  res.render('search/index', { placeholder: 'Station, stop or route' })
})

function expandSearchQuery(query) {
  return utils.adjustStopName(utils.titleCase(query, true).replace('Sc', 'Shopping Centre')).toLowerCase()
    .replace(/  +/, ' ')
    .replace(/fed sq.+/, 'federation square')
    .replace(/(\b)qvm(\b)/, '$1queen victoria market$2')
    .replace(/(\b)vic(\b)/, '$1victoria$2')
}

async function prioritySearch(db, query) {
  let stops = db.getCollection('stops')

  if (stationCodes[query.toUpperCase()]) {
    return await stops.findDocuments({
      stopName: stationCodes[query.toUpperCase()] + ' Railway Station'
    }).toArray()
  }

  const fullQuery = expandSearchQuery(query)
  const queryWords = fullQuery.split(/[^\w]/)
  const searchedWords = queryWords.filter(word => word.length >= 4)
  const shortWords = queryWords.filter(word => word.length < 4)

  const stations = searchedWords.length ? (await stops.findDocuments({
    $and: [
      ...(searchedWords.map(name => ({ textQuery: name }))),
      {
        mergeName: /Railway Station/
      }
    ]
  }, { textQuery: 0 }).limit(8).toArray())
    .filter(stop => shortWords.every(word => stop.stopName.toLowerCase().includes(word)))
    : []

  let priorityStopsByName = searchedWords.length ? (await stops.findDocuments({
    $and: [
      ...(searchedWords.map(name => ({ textQuery: name }))),
      {
        _id: {
          $not: {
            $in: stations.map(s => s._id)
          }
        }
      },
      {
        $or: [{
          mergeName: /Shopping Centre/
        }, {
          mergeName: /University/
        }, {
          mergeName: /Town Centre/
        }]
      }
    ]
  }, { textQuery: 0 }).limit(8).toArray())
    .filter(stop => shortWords.every(word => stop.stopName.toLowerCase().includes(word)))
    .sort((a, b) => a.stopName.length - b.stopName.length)
    : []

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

  return gtfsMatch.concat(numericalMatchStops).concat(priorityStopsByName).concat(stations)
}

async function findStops(db, rawQuery) {
  let stops = db.getCollection('stops')

  if (!rawQuery.length) return []

  let prioritySearchResults = await prioritySearch(db, rawQuery)
  let excludedIDs = prioritySearchResults.map(stop => stop._id)

  let query = expandSearchQuery(rawQuery)

  let queryRegex = new RegExp(query, 'i')
  let searchRegex = new RegExp(query, 'i')
  let stationRegex = new RegExp(query.replace(/sta?t?i?o?n?/i, 'railway station'), 'i')

  const queryWords = query.split(/[^\w]/)
  const searchedWords = queryWords.filter(word => word.length >= 4)
  const shortWords = queryWords.filter(word => word.length < 4)

  let remainingResults = (await stops.findDocuments({
    _id: {
      $not: {
        $in: excludedIDs
      }
    },
    $and: [
      ...(searchedWords.map(name => ({ textQuery: name }))),
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
  }).limit(15 - prioritySearchResults.length).toArray())
    .filter(stop => shortWords.every(word => stop.stopName.toLowerCase().includes(word)))
    .sort((a, b) => a.stopName.length - b.stopName.length)

  let lowPriorityResults = await stops.findDocuments({
    _id: {
      $not: {
        $in: excludedIDs.concat(remainingResults.map(stop => stop._id))
      }
    },
    $and: [
      ...(searchedWords.map(name => ({ textQuery: name }))),
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

  let currentResults = [
    ...addDistance(prioritySearchResults, rawQuery).sort((a, b) => a.distance - b.distance),
    ...addDistance(remainingResults, rawQuery).sort((a, b) => a.distance - b.distance),
    ...lowPriorityResults
  ]

  return currentResults
}

async function findRoutes(db, query) {
  const routes = await db.getCollection('routes')
  query = query.replace(/ li?n?e?\b/, '').trim()
  if (query.length) {
    let queryRegex = new RegExp(query, 'i')

    const queryTokens = query.split(' ')
    const words = queryTokens.filter(w => !w.match(/^\d+$/))
    const numbers = queryTokens.filter(w => w.match(/^\d+$/))
    const anyWord = { $in: words.map(w => new RegExp(w, 'i')) }

    const regionMatch = await routes.findDocuments({
      routeNumber: { $in: numbers.map(w => new RegExp('^' + w)) },
      $or: [{
        routeName: anyWord
      }, {
        'directions.stops.suburb': anyWord
      }]
    }).toArray()

    const approxMatch = words.length ? await routes.findDocuments({
      _id: {
        $not: {
          $in: regionMatch.map(r => r._id)
        }
      },
      $and: words.map(w => ({ routeName: new RegExp(w, 'i') }))
    }).toArray() : []

    return regionMatch.concat(approxMatch).concat(await routes.findDocuments({
      _id: {
        $not: {
          $in: approxMatch.map(r => r._id).concat(regionMatch.map(r => r._id))
        }
      },
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