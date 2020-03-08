const express = require('express')
const utils = require('../../utils')
const router = new express.Router()

router.get('/', (req, res) => {
  res.render('tourbusminder/index')
})

module.exports = router
