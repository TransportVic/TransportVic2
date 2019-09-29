const express = require('express')
const router = new express.Router()

router.get('/', (req, res) => {
  res.render('geojson-visualise')
})

module.exports = router
