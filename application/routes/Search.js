const express = require('express')
const router = new express.Router()
const async = require('async')
const safeRegex = require('safe-regex')

router.get('/', (req, res) => {
  res.render('search/index', { placeholder: 'Station, stop or route' })
})

async function performSearch (db, query) {
  return (await db.getCollection('stops').findDocuments({
    $or: [
      { 'bays.stopGTFSID': parseInt(query) },
      { stopName: new RegExp(query, 'i') },
      { suburb: new RegExp(query, 'i') },
      { tramTrackerIDs: parseInt(query) },
    ]
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
