const express = require('express')
const router = new express.Router()

router.get('/comeng/:tdn', async (req, res) => {
  res.render('mockups/train-pids/comeng')
})


module.exports = router
