module.exports.getURL = (station, pid) => {
  let pidURL
  if (pid.concourse) {
    pidURL = `/mockups/metro-lcd/concourse/${station}/${pid.type}${pid.query ? '?' + pid.query : ''}`
  }

  if (pid.type === 'trains-from-fss') pidURL = '/mockups/fss/trains-from-fss'
  if (pid.type === 'half-platform-bold') pidURL = `/mockups/metro-lcd/${station}/${pid.platform}/half-platform-bold`
  if (pid.type === 'half-platform') pidURL = `/mockups/metro-lcd/${station}/${pid.platform}/half-platform`
  if (pid.type === 'platform') pidURL = `/mockups/metro-lcd/${station}/${pid.platform}/platform`
  if (pid.type === 'pre-platform-vertical') pidURL = `/mockups/metro-lcd/${station}/${pid.platform}/pre-platform-vertical`
  if (pid.type === 'vline-half-platform') pidURL = `/mockups/vline/${station}/${pid.platform}`
  if (pid.type === 'fss-escalator') pidURL = `/mockups/fss/escalator/${pid.platform}/${station}/`
  if (pid.type === 'fss-platform') pidURL = `/mockups/fss/platform/${pid.platform}/${station}/`
  if (pid.type === 'sss-platform') pidURL = `/mockups/sss/platform/${pid.platform * 2 - 1}-${pid.platform * 2}/`
  if (pid.type === '2-line-led') pidURL = `/mockups/metro-led-pids/${station}/${pid.platform}`
  if (pid.type === 'crt') pidURL = `/mockups/metro-crt/${station}/${pid.platform}`

  return pidURL
}

let stationsCache = {}

module.exports.getStation = async (db, stationName) => {
  let station
  if (!(station = stationsCache[stationName])) {
    station = await db.getCollection('stops').findDocument({
      codedName: (stationName || 'flinders-street') + '-railway-station'
    })
    stationsCache[stationName] = station
  }

  return station
}
