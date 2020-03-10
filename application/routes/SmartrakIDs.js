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

    let parts

    if (!smartrakID || !fleetNumber || !(parts = fleetNumber.match(/^([A-Z]{1,2})\d+$/))) {
      if (fleetNumber === '-') {
        await smartrakIDs.deleteDocument({ smartrakID })
        await smartrakIDs.deleteDocument({ fleetNumber: line[0] })
        return
      } else if (fleetNumber && !(parts = fleetNumber.match(/^(MK|WM)(\d\d[A-Z][A-Z])$/)) && !(parts = fleetNumber.match(/^RR(\d+[A-Z]*)$/))) {
        failedMessage += `Line ${i + 1} ${line.join(' ')} failed: did not match format\n`
        return
      }
    }

    let operator = parts[1]
    try {
      await smartrakIDs.replaceDocument({
        smartrakID
      }, {
        smartrakID, fleetNumber, operator
      }, { upsert: true })
    } catch (e) {
      failedMessage += `Line ${i + 1} ${line.join(' ')} failed: ${fleetNumber} already exists\n`
    }
  })

  let count = await smartrakIDs.countDocuments()

  if (failedMessage) res.end(failedMessage)
  else res.end(failedMessage + `Ok - ${count} Smartrak IDs in DB`)
})

module.exports = router
