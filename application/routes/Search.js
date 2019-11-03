const express = require('express')
const router = new express.Router()
const async = require('async')
const safeRegex = require('safe-regex')

router.get('/', (req, res) => {
  res.render('search/index', { placeholder: 'Station, stop or route' })
})

async function performSearch (db, query) {
  let search

  let nquery = parseInt(query)
  if (nquery) {
    search = [
      { 'bays.stopGTFSID': parseInt(query) },
      { tramTrackerIDs: parseInt(query) }
    ]
  } else {
    search = [
      { suburb: new RegExp(query, 'i') }
    ]
  }

  let possibleStopNames = [query]
  possibleStopNames.push(query.replace(/st?a?t?i?o?n?/i, 'railway station'))
  possibleStopNames.push(query.replace(/ sc/i, ' shopping centre'))

  search = search.concat(possibleStopNames.map(name => ({stopName: new RegExp(name, 'i')}) ))

  return (await db.getCollection('stops').findDocuments({
    $or: search
  }).limit(15).toArray()).sort((a, b) => a.stopName.length - b.stopName.length)
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
