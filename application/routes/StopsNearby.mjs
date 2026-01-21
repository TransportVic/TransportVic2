import express from 'express'
import utils from '../../utils.mjs'

const router = new express.Router()

const typeMap = {
  'bus': 'Bus Stop',
  'metro train': 'Metro Train Station',
  'regional train': 'V/Line Train Station',
  'regional coach': 'V/Line Coach Stop',
  'tram': 'Tram Stop',
  'ferry': 'Ferry Terminal',
  'heritage train': 'Heritage Train Station'
}

function getClosestDistance(userPosition, positions) {
  let userLat = userPosition.latitude, userLong = userPosition.longitude
  let distances = positions.map(position => utils.getDistanceFromLatLon(position[1], position[0], userLat, userLong))

  return distances.sort((a, b) => a - b)[0]
}


function expandStop(stop) {
  let modes = []
  let stops = {}

  stop.bays.forEach(bay => {
    if (!modes.includes(bay.mode)) {
      modes.push(bay.mode)

      stops[bay.mode] = {
        stopName: stop.stopName,
        stopNumber: bay.stopNumber,
        mode: bay.mode,
        suburb: stop.suburb[0],
        cleanSuburbs: stop.cleanSuburbs[0],
        type: typeMap[bay.mode],
        location: stop.location,
        cleanName: stop.cleanName
      }
    }
  })

  return Object.values(stops)
}

async function getNearbyStops(db, position) {
  let stops = await db.getCollection('stops').findDocuments({
    location: {
      $nearSphere: {
        $geometry: {
          type: 'Point',
          coordinates: [position.longitude, position.latitude]
        },
        $maxDistance: 500
      }
    }
  }).toArray()

  return stops.map(expandStop)
    .reduce((acc, stop) => acc.concat(stop), [])
    .map(stop => {
      stop.smallestDistance = getClosestDistance(position, stop.location.coordinates)
      return stop
    }).sort((a, b) => a.smallestDistance - b.smallestDistance)
}

router.get('/', (req, res) => {
  res.render('nearby/index')
})

router.post('/', async (req, res) => {
  let stops = await getNearbyStops(res.db, req.body)
  res.render('nearby/render', {stops})
})

export default router