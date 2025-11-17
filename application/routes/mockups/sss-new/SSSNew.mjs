import express from 'express'
const router = new express.Router()

router.get('/', async (req, res) => {
  res.render('mockups/sss-new/summary')
})

export default router