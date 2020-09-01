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
  if (pid.type === 'fss-escalator') pidURL = `/mockups/fss/escalator/${pid.platform}/${station}/`
  if (pid.type === 'fss-platform') pidURL = `/mockups/fss/platform/${pid.platform}/${station}/`
  if (pid.type === 'sss-platform') pidURL = `/mockups/sss/platform/${pid.platform * 2 - 1}-${pid.platform * 2}/`

  return pidURL
}
