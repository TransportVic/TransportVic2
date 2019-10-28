const express = require('express')
const router = new express.Router()
const async = require('async')

router.get('/', (req, res) => {
  res.render('smartrak/index')
})

router.post('/load', async (req, res) => {
  let {content} = req.body
  let lines = content.trim().split('\n').map(line => line.split(' '))
  let smartrakIDs = res.db.getCollection('smartrak ids')
  let failedMessage = ''

  await async.forEach(lines, async line => {
    let i = lines.indexOf(line)
    let smartrakID = parseInt(line[0]),
        fleetNumber = line[1]

    if (!(smartrakID && fleetNumber && fleetNumber.match(/^[A-Z]{1,2}\d+$/))) {
      if (fleetNumber === '-') {
        await smartrakIDs.deleteDocument({ smartrakID })
      } else
        failedMessage += `Line ${i} ${line} failed: did not match format`
    } else {
      await smartrakIDs.replaceDocument({
        smartrakID
      }, {
        smartrakID, fleetNumber
      }, { upsert: true })
    }
  })

  if (failedMessage) res.end(failedMessage)
  else res.end('Ok')
})

module.exports = router
