import express from 'express'
import PIDBackend from './PIDBackend.mjs'

const router = new express.Router()

let stoppingTextMap = {
  stopsAll: 'Stops All Stations',
  allExcept: 'All Except {0}',
  expressAtoB: '{0} to {1}',
  sasAtoB: 'Stops All Stations from {0} to {1}',
  runsExpressAtoB: 'Runs Express from {0} to {1}',
  runsExpressTo: 'Runs Express to {0}',
  thenRunsExpressTo: 'then Runs Express to {0}',
  thenRunsExpressAtoB: 'then Runs Express from {0} to {1}',
  sasTo: 'Stops All Stations to {0}',
  stopsAt: 'Stops At {0}',
  thenSASTo: 'then Stops All Stations to {0}'
}

let stoppingTypeMap = {
  noSuburban: 'V/Line Service',
  notTakingPax: 'Not Taking Passengers',
  vlinePostfix: ', Not Taking Suburban Passengers',
  stopsAll: 'Stops All Stations',
  limitedExpress: 'Limited Express',
  express: 'Express Service'
}

async function getData(req, res) {
  let station = await PIDBackend.getStation(req.params.station, res.db)

  return await PIDBackend.getPIDData(station, req.params.platform, {
    stoppingType: stoppingTypeMap,
    stoppingText: stoppingTextMap
  }, res.db)
}

router.get('/:station/:platform', async (req, res) => {
  getData(req, res)

  res.render('mockups/metro-led-pids/pids.pug')
})

router.post('/:station/:platform', async (req, res) => {
  let departures = await getData(req, res)

  res.json(departures)
})

export default router


/*

FORMATS:
Stops All Stations
All Except $STATION
Express Service; Stops All Station to Dandenong, Runs Express from Dandenong to Noble Park, Stops All Stations from Noble Park to Springvale, Runs Express from Springvale to Clayton, Stops All Stations from Clayton to Caulfield, Runs Express from Caulfield to South Yarra, then Stops All Stations to Flinders Street
*/


/*
box: 335px wide, 120 tall
2.72:1

blue bit 60px, 50% height
white line 8px from top, 6% height
2px tall, 1.6% height
text 20px from top, 25% height, font size 10px 8.3%

next train 15px from left, 54px wide, 10px from top
destination 18px from left, 60px wide, 10px from top
min to depart 135px from left, 40px wide

light bit 320px wide, center, 95%w, 54 tall 45%h
. matrix 302px wide 17px tall, 9px inbetween


*/
