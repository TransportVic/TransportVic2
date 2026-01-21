import express from 'express'
import bayData from '../../additional-data/bus-data/bus-bays.mjs'
import trainReplacementBays from '../../additional-data/train-replacement-bays.json' with { type: 'json' }
import platformGeometry from '../../additional-data/station-platform-geometry.json' with { type: 'json' }
import stationBikes from '../../additional-data/metro-data/geospatial/station-bikes.json' with { type: 'json' }
import stationCarparks from '../../additional-data/metro-data/geospatial/station-carparks.json' with { type: 'json' }
import turf from '@turf/turf'

const router = new express.Router()

router.post('/:suburb/:stopName', async (req, res) => {
  let stops = res.db.getCollection('stops')
  let stop = await stops.findDocument({
    cleanName: req.params.stopName,
    cleanSuburbs: req.params.suburb
  })

  if (!stop) return res.json(null)

  let trainStationName = stop.stopName.slice(0, -16)

  stop.trainReplacementBays = trainReplacementBays[trainStationName]
  if (stop.trainReplacementBays) {
    let extraLocations = stop.trainReplacementBays.map(e => e.location.coordinates)
    stop.stationName = trainStationName
    stop.location.coordinates = stop.location.coordinates.concat(extraLocations)
  }

  stop.platformGeometry = platformGeometry[trainStationName] || []
  stop.carpark = stationCarparks[trainStationName] || []
  stop.bikes = stationBikes[trainStationName] || []

  let allFeatures = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: stop.location
      }
    ]
  }

  allFeatures.features = allFeatures.features.concat(stop.platformGeometry.map(g => ({
    type: "Feature",
    geometry: g.geometry
  }))).concat(stop.carpark.map(c => ({
    type: "Feature",
    geometry: c.geometry
  }))).concat(stop.bikes.map(b => ({
    type: "Feature",
    geometry: b.geometry
  })))



  let bbox = turf.bboxPolygon(turf.bbox(allFeatures))
  stop.bbox = bbox
  res.json(stop)
})

router.get('/:suburb/:stopName', (req, res) => {
  res.render('stop-preview')
})

router.get('/bays', (req, res) => {
  res.json(bayData)
})

export default router