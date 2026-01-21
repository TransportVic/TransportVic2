import express from 'express'
import utils from '../../utils.mjs'

const router = new express.Router()

router.get('/', (req, res) => {
  res.render('index')
})

router.get('/bookmarks', (req, res) => {
  res.render('bookmarks')
})

router.get('/colours', async (req, res) => {
  let operators = (await res.db.getCollection('routes').distinct('operators')).sort()
  let tramRoutes = await res.db.getCollection('routes').distinct('routeNumber', { mode: 'tram' })
  let trainLines = await res.db.getCollection('routes').distinct('routeName', { mode: 'metro train' })

  operators = operators.map(operator => {
    return {
      cssName: utils.encodeName(operator),
      originalName: operator
    }
  })
  trainLines = trainLines.map(operator => {
    return {
      cssName: utils.encodeName(operator),
      originalName: operator
    }
  })
  tramRoutes = tramRoutes.map(route => route.replace('/3a', ''))
    .sort((a, b) => a - b)
  res.render('colours', {operators, tramRoutes, trainLines})
})

export default router
