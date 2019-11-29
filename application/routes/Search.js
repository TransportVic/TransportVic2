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

  let search = possibleStopNames.map(name => ({stopName: new RegExp(name, 'i')}))

  let priorityStopsByName = (await db.getCollection('stops').findDocuments({
    $or: search
  }).toArray()).filter(stop => {
    return stop.stopName.includes('Shopping Centre') || stop.stopName.includes('Railway Station')
      || stop.stopName.includes('University')
  }).sort((a, b) => a.length - b.length)
  let nquery = parseInt(query)
  let gtfsMatch = await db.getCollection('stops').findDocuments({
    'bays.stopGTFSID': nquery
  }).toArray()

  let numericalMatchStops = (await db.getCollection('stops').findDocuments({
    $or: [{
      tramTrackerIDs: nquery
    }, {
      'bays.stopNumber': query.replace('#', '')
    }]
  }).toArray()).sort((a, b) => a.length - b.length)

  return gtfsMatch.concat(numericalMatchStops).concat(priorityStopsByName)
}

async function performSearch (db, query) {
  let search

  let prioritySearchResults = await prioritySearch(db, query)
  let excludedIDs = prioritySearchResults.map(stop => stop._id)

  let queryRegex = new RegExp(query, 'i')

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
    }]
  }).limit(15 - prioritySearchResults.length).toArray()).sort((a, b) => a.length - b.length)

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
    }]
  }).limit(15 - prioritySearchResults.length - remainingResults.length).toArray()

  return prioritySearchResults.concat(remainingResults).concat(lowPriorityResults)
}

router.post('/', async (req, res) => {
  let query = req.body.query.trim()
  if (!safeRegex(query) || query === '') {
    return res.end('')
  }

  const results = await performSearch(res.db, query)

  res.render('search/results', {results})
})

module.exports = router
