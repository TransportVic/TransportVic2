const express = require('express')
const router = new express.Router()
const async = require('async')
const safeRegex = require('safe-regex')

router.get('/', (req, res) => {
  res.render('search/index', { placeholder: 'Enter a station' })
})

async function performSearch (db, query) {
  return await db.getCollection('stops').findDocuments({
    $or: [
      { 'bays.stopGTFSID': query },
      { stopName: new RegExp(query, 'i') },
      { stopSuburb: new RegExp(query, 'i') },
    ]
  }).toArray()
}

router.post('/', async (req, res) => {
  if (!safeRegex(req.body.query)) {
    return res.end('')
  }

  const results = await performSearch(res.db, req.body.query)
  
  res.render('search/results', {results})
})

module.exports = router
