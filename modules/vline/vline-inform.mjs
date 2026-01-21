import VLineMailServer from "@transportme/vline-mail-server"
import lineStops from '../../additional-data/vline-data/line-stops.json' with { type: 'json' }
import vlineStations from '../../additional-data/vline-data/stations.json' with { type: 'json' }
import utils from '../../utils.mjs'

const lineGroups = {
  "South Western": [ "Geelong", "Warrnambool" ],
  "Western": [ "Ararat", "Ballarat", "Maryborough" ],
  "Northern": [ "Bendigo", "Echuca", "Swan Hill" ],
  "North Eastern": [ "Albury", "Seymour", "Shepparton" ],
  "Eastern": [ "Traralgon", "Bairnsdale" ]
}

export async function matchService(db, serviceData) {
  const liveTimetables = db.getCollection('live timetables')
  const timetables = db.getCollection('timetables')
  const now = utils.now()
  
  const isPostMidnightTrip = !!serviceData.departureTime.match(/^0[012]/)
  const isAfter10pm = !!serviceData.departureTime.match(/^2[23]/)

  const isInAmbiguousRegion = now.get('hours') < 4
  const isBefore3am = now.get('hours') < 3

  const operationDay = isInAmbiguousRegion ? (
    (isAfter10pm || isPostMidnightTrip) ? (
      isBefore3am ? utils.getPTYYYYMMDD(now) : utils.getPTYYYYMMDD(now.add(-1, 'day'))
     ) : utils.getYYYYMMDD(now)
  ) : utils.getPTYYYYMMDD(now) 

  const query = {
    mode: 'regional train',
    origin: `${serviceData.origin} Railway Station`,
    destination: `${serviceData.destination} Railway Station`,
    departureTime: isPostMidnightTrip ? utils.adjustPTHHMM(serviceData.departureTime) : serviceData.departureTime
  }

  const liveTrip = await liveTimetables.findDocument({
    ...query,
    operationDays: operationDay
  })
  if (liveTrip) return liveTrip

  const nspTrip = await timetables.findDocument({
    ...query,
    operationDays: utils.getDayOfWeek(now)
  })

  if (nspTrip) {
    return await liveTimetables.findDocument({
      operationDays: operationDay,
      runID: nspTrip.runID
    })
  }
}

export async function createAlert(db, payload) {
  const vlineInform = db.getCollection('vline inform')
  const server = new VLineMailServer(null, { vlineStations, lineStops })

  const messageData = server.onMessage({
    subject: payload.Subject,
    html: payload['stripped-text'] || ''
  })

  if (messageData.messageType === 'non_specific') return
  const { messageType, serviceData, specificData, text } = messageData
  const trip = await matchService(db, serviceData)
  if (!trip) return

  await vlineInform.createDocument({
    routeName: lineGroups[Object.keys(lineGroups).find(group => lineGroups[group].includes(serviceData.line))],
    active: true,
    acknowledged: false,
    fromDate: +utils.now() / 1000,
    toDate: +utils.parseDate(trip.operationDays).add(trip.stopTimings[trip.stopTimings.length - 1].arrivalTimeMinutes + 15, 'minutes') / 1000,
    type: messageType,
    specificData,
    text,
    date: trip.operationDays,
    runID: trip.runID
  })
}