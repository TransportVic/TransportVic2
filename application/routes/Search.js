const express = require('express')
const router = new express.Router()
const async = require('async')
const safeRegex = require('safe-regex')

router.get('/', (req, res) => {
  res.render('search/index', { placeholder: 'Enter a station' })
})

async function performSearch(db, query) {
  let collections = {
    vlineStations: 'vline railway stations'
  };
  let results = {};

  await async.forEachOf(collections, async (value, key) => {
    results[key] = await db.getCollection(value).findDocuments({
      $or: [
        { gtfsID: query },
        { name: new RegExp(query, 'i') }
      ]
    }).toArray()
  })

  return results
}

router.post('/', async (req, res) => {
  if (!safeRegex(req.body.query)) {
    return res.end('')
  }

  let results = await performSearch(res.db, req.body.query)

  res.render('search/results', results)
})

module.exports = router
