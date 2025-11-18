import { GTFS_CONSTANTS } from '@transportme/transportvic-utils'
import { NON_MTP_STOPS } from './line-groups.mjs'

const { TRANSIT_MODES } = GTFS_CONSTANTS

const isStationLevel = alert => alert.type === 'works' || alert.type === 'suspended' || alert.type === 'general'
const isIndividual = alert => !!alert.runID
const isSuspended = alert => alert.type === 'suspended'
const isDelay = alert => !isIndividual(alert) && (alert.type === 'minor' || alert.type === 'major') 

export async function getStationAlerts(station, db) {
  const metroBays = station.bays.filter(bay => bay.mode === TRANSIT_MODES.metroTrain)
  const allScreenServices = metroBays.flatMap(bay => bay.screenServices).map(service => service.routeGTFSID)
  const uniqueRouteGTFSIDs = Array.from(new Set(allScreenServices))
  const routeNames = await db.getCollection('routes').distinct('routeName', {
    mode: TRANSIT_MODES.metroTrain,
    routeGTFSID: { $in: uniqueRouteGTFSIDs }
  })

  const activeAlerts = await db.getCollection('metro notify').findDocuments({
    routeName: { $in: routeNames },
    active: true
  }).toArray()

  const stationLevel = activeAlerts.filter(isStationLevel).map(alert => {
    if (alert.type === 'works') {
      alert.text = alert.text.replace(/<p>Visit our.+/gm, '').replace(/<p>Plan your.+/gm, '').trim().replaceAll('&#8211;', '-')
    }
    return alert
  })

  const individual = activeAlerts.filter(isIndividual).map(alert => {
    const summary = alert.text.match(/<p>(.+)<\/p>/)
    if (summary) alert.summary = simplifySummary(summary[1].replaceAll('&#8211;', '-'))

    return alert
  })

  const suspended = activeAlerts.filter(isSuspended).reduce((acc, alert) => {
    const summary = alert.text.match(/(Buses replace .+\.)/)
    if (summary) alert.summary = summary[1].replaceAll('&#8211;', '-')
    for (const line of alert.routeName) acc[line] = alert

    return acc
  }, {})

  const rawDelays = activeAlerts.filter(isDelay)
  const delays = rawDelays.reduce((acc, alert) => {
    const summaryData = alert.text.match(/<p>(.+)<\/p>/)

    if (summaryData) {
      const summary = summaryData[1]
      const maxDelay = getMaxDelay(summary)
      const direction = getDirection(summary)

      alert.maxDelay = maxDelay
      alert.direction = direction
      alert.summary = summary
    }

    for (const line of alert.routeName) acc[line] = alert

    return acc
  }, {})

  return {
    general: stationLevel,
    individual,
    suspended,
    delays,
    rawDelays
  }
}

export function simplifySummary(text) {
  return text.replace(/^The \d+:\d+[ap]m [\w ]+ to [\w ]+(?: service)? (will|has|is|shall|was)/, 'This service $1')
}

export function getMaxDelay(text) {
  const parts = text.match(/(\d+) ?min/)
  return parts ? parseInt(parts[1]) : null
}

export function getDirection(rawText) {
  const text = rawText.toLowerCase()
  const hasUp = text.includes('city bound') || text.includes('citybound') || text.includes('inbound') || text.includes('in bound')
  const hasDown = text.includes('outbound') || text.includes('out bound')

  if (hasUp && hasDown) return null
  if (hasUp) return 'Up'
  if (hasDown) return 'Down'
  return null
}

export function shouldShowDelays(station) {
  return !NON_MTP_STOPS.includes(station.stopName.slice(0, -16))
}