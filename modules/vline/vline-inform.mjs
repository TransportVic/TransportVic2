import VLineMailServer from "@transportme/vline-mail-server"
import lineStops from '../../additional-data/vline-data/line-stops.json' with { type: 'json' }
import vlineStations from '../../additional-data/vline-data/stations.json' with { type: 'json' }
import utils from '../../utils.js'

const lineGroups = {
  "South Western": [ "Geelong", "Warrnambool" ],
  "Western": [ "Ararat", "Ballarat", "Maryborough" ],
  "Northern": [ "Bendigo", "Echuca", "Swan Hill" ],
  "North Eastern": [ "Albury", "Seymour", "Shepparton" ],
  "Eastern": [ "Traralgon", "Bairnsdale" ]
}

export async function createAlert(db, payload) {
  const vlineInform = db.getCollection('vline inform')
  const server = new VLineMailServer(null, { vlineStations, lineStops })

  const messageData = server.onMessage({
    subject: payload.Subject,
    html: payload['stripped-text'] || ''
  })

  if (messageData.messageType === 'non_specific') return
  const { messageType, serviceData, specificData } = messageData
  console.log(messageData)
  await vlineInform.createDocument({
    routeName: lineGroups[Object.keys(lineGroups).find(group => lineGroups[group].includes(serviceData.line))],
    active: true,
    acknowledged: false,
    fromDate: +utils.now() / 1000,
    type: messageType
  })
}