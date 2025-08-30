import utils from '../../../utils.js'
import urls from '../../../urls.json' with { type: 'json' }

export async function getGPSPositions() {
  return JSON.parse(await utils.request(urls.gpsPositions)).trains.map(svc => ({
    location: {
      type: 'Point',
      coordinates: [svc.lng, svc.lat]
    },
    updateTime: utils.parseTime(svc.dt, 'YYYY-MM-DD HH:mm:ss'),
    vehicle: svc.loco || svc.veh,
    runID: svc.srv,
    operator: svc.cmp
  }))
}

console.log(JSON.stringify(await getGPSPositions(), null, 2))
