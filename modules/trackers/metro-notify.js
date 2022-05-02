const async = require('async')
const config = require('../../config')
const modules = require('../../modules')
const utils = require('../../utils')
const urls = require('../../urls')
const DatabaseConnection = require('../../database/DatabaseConnection')
const { closest } = require('fastest-levenshtein')
const terminatingLocations = require('../../additional-data/metro-terminating-locations')
const getStoppingPattern = require('../metro-trains/get-stopping-pattern')

let database
let liveTimetables, metroShunts

let allStops = []
let routeIDs = {
  '82': 'Alamein',
  '84': 'Belgrave',
  '85': 'Craigieburn',
  '86': 'Cranbourne',
  '87': 'Mernda',
  '88': 'Frankston',
  '89': 'Glen Waverley',
  '90': 'Hurstbridge',
  '91': 'Lilydale',
  '92': 'Pakenham',
  '93': 'Sandringham',
  '94': 'Stony Point',
  '95': 'Sunbury',
  '96': 'Upfield',
  '97': 'Werribee',
  '98': 'Williamstown',
  '92761': 'Showgrounds',
  '168307': 'Flemington Racecourse'
}

let allRoutes = Object.values(routeIDs).slice(0, -1)

async function lookForShunts(allAlerts) {
  let terminatingAlerts = allAlerts.filter(alert => {
    return alert.type !== 'works'
      && alert.runID && (alert.text.includes('terminat') // terminate/terminating
      || alert.text.includes('origin'))
  })

  await async.forEach(terminatingAlerts, async alert => {
    let relavantText = ''
    let type
    if (alert.text.includes('terminat')) {
      relavantText = alert.text.slice(alert.text.indexOf('terminat') + 11)
      type = 'terminate'
    } else {
      relavantText = alert.text.slice(alert.text.indexOf('origin') + 9)
      type = 'originate'
    }
    relavantText = relavantText.trim().split('\n')[0].replace(/due.*/, '').replace(/today.*/, '')

    let bestStop = closest(relavantText, allStops)
    let isTrainFault = alert.text.includes('train fault')

    let liveTimetable = await liveTimetables.findDocument({
      operationDays: utils.getYYYYMMDD(utils.now()),
      mode: 'metro train',
      runID: alert.runID
    })

    let tripAlerts = (liveTimetable ? liveTimetable.notifyAlerts : []) || []
    let mismatch = false
    if (liveTimetable) {
      mismatch = (type === 'originate' ? liveTimetable.trueOrigin : liveTimetable.trueDestination).slice(0, -16) !== bestStop
    }

    if ((!tripAlerts.includes(alert.alertID) || mismatch) && (liveTimetable ? !liveTimetable.h : true)) {
      liveTimetable = await getStoppingPattern({
        routeName: liveTimetable.routeName,
        ptvRunID: utils.getPTVRunID(alert.runID),
        time: utils.now()
      }, database)
    }

    if (type === 'terminate') {
      if (isTrainFault || !terminatingLocations.includes(bestStop)) {
        let lastStop = liveTimetable.stopTimings.find(stop => stop.stopName.slice(0, -16) === bestStop)
        let shunt = {
          date: liveTimetable.operationDays,
          runID: alert.runID,
          routeName: liveTimetable.routeName,
          stationName: bestStop,
          arrivalTimeMinutes: lastStop.arrivalTimeMinutes,
          type: 'EMPTY_CARS',
          platform: lastStop.platform,
          forming: alert.runID,
          notifyAlert: alert.alertID
        }

        await metroShunts.replaceDocument({
          date: liveTimetable.operationDays,
          runID: alert.runID
        }, shunt, {
          upsert: true
        })
      }
    }
  })
}

async function requestData() {
  let metroNotify = database.getCollection('metro notify')

  let data = JSON.parse(await utils.request(urls.metroNotify))

  let mergedAlerts = {}

  Object.keys(data)
  .filter(key => !isNaN(parseInt(key)))
  .map(key => data[key])
  .filter(routeData => routeData.alerts && routeData.alerts instanceof Array)
  .map(routeData => routeData.alerts)
  .reduce((a, e) => a.concat(e), [])
  .forEach(alert => {
    let routeName = routeIDs[alert.line_id]

    if (!mergedAlerts[alert.alert_id]) {
      mergedAlerts[alert.alert_id] = {
        alertID: alert.alert_id,
        routeName: [routeName],
        fromDate: parseInt(alert.from_date),
        toDate: parseInt(alert.to_date),
        type: alert.alert_type,
        text: alert.alert_text.replace(/Plan your journey.*/, '').replace(/Visit .*? web.*/g, '').replace(/[–-]/g, ' to ').replace(/  +/g, ' ').trim(),
        active: true,
        ...(alert.trip_id ? { runID: alert.trip_id } : {})
      }
    } else {
      mergedAlerts[alert.alert_id].routeName.push(routeName)
    }
  })

  if (data.general) {
    let alert = data.general
    let alertID = alert.from_date + alert.to_date

    mergedAlerts[alertID] = {
      alertID,
      routeName: allRoutes,
      fromDate: parseInt(alert.from_date),
      toDate: parseInt(alert.to_date),
      type: 'general',
      text: `${alert.title}\n${alert.body}`.replace(/  +/g, ' '),
      active: true
    }
  }

  /*
    /MTMHealthboardDisruptionStage={NEW_INCIDENT:0,REPLACEMENT_BUSES_COMMENCED:1,ESTABLISHED_END_OF_SUSPENSION:2,SERVICE_RESUMED:3}
    Looks to be only used for suspensions
  */
  if (data.disruptions) {
    data.disruptions.forEach(disruption => {
      mergedAlerts[disruption.id] = {
        alertID: disruption.id.toString(),
        routeName: disruption.lines.map(routeID => routeIDs[routeID]),
        fromDate: parseInt(disruption.from_date),
        toDate: parseInt(disruption.to_date),
        type: disruption.alert_type,
        text: disruption.notice.replace(/  +/g, ' '),
        active: true
      }
    })
  }

  let bulkOperations = []
  let activeAlerts = Object.values(mergedAlerts)
  activeAlerts.forEach(alert => {
    bulkOperations.push({
      replaceOne: {
        filter: { alertID: alert.alertID },
        replacement: alert,
        upsert: true
      }
    })
  })

  let alertIDs = Object.keys(mergedAlerts)
  await metroNotify.updateDocuments({
    alertID: {
      $not: {
        $in: alertIDs
      }
    },
    active: true
  }, {
    $set: {
      active: false
    }
  })

  if (bulkOperations.length) {
    await metroNotify.bulkWrite(bulkOperations)
  }

  await lookForShunts(activeAlerts)
}

if (modules.tracker && modules.tracker.metroNotify) {
  database = new DatabaseConnection(config.databaseURL, config.databaseName)
  database.connect(async () => {
    liveTimetables = database.getCollection('live timetables')
    metroShunts = database.getCollection('metro shunts')
    allStops = (await database.getCollection('stops').distinct('stopName', {
      'bays.mode': 'metro train'
    })).map(stop => stop.slice(0, -16))

    await requestData()
    process.exit()
  })
} else process.exit()
