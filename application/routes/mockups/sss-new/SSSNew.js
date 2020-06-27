const express = require('express')
const router = new express.Router()

router.get('/', async (req, res) => {
  res.render('mockups/sss-new/summary')
})

module.exports = router
