const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const urls = require('./urls')

let trainType = {
  'NS Comeng': 'Comeng',
  'SS Comeng': 'Comeng',
  'XTrapolis': 'Xtrapolis',
  'Siemens': 'Siemens'
}

utils.request(urls.ptDatabaseMetro).then(data => {
  let parsed = JSON.parse(data)

  let validTrains = parsed
    .filter(train => trainType[train.trainType])
    .map(train => ({
      type: train.trainType,
      consist: [train.m1, train.t1, train.m2]
    }))
    .filter(train => !(train.consist.includes('-') || train.consist.includes('')))

  let types = validTrains.map(train => ({
    leadingCar: train.consist[0],
    type: trainType[train.type],
    ...(train.type.endsWith('Comeng') ? {
      variant: train.type.slice(0, 2)
    } : {})
  }))

  let consists = validTrains.map(train => train.consist)

  utils.request(urls.ptDatabaseHCMT).then(hcmtData => {
    let parsedHCMT = JSON.parse(hcmtData)
    consists = consists.concat(parsedHCMT.map(train => {
      let rawTrain = [train.tc1, train.dmp1, train.mp1, train.dt1, train.dmp2, train.dt2, train.mp3, train.dmp3, train.tc2]
      return rawTrain.filter(x => x !== '-' && x)
    }))

    types = types.concat(parsedHCMT.map(train => ({
      leadingCar: train.tc1,
      type: 'HCMT'
    })))

    fs.writeFileSync(path.join(__dirname, 'additional-data/metro-tracker/metro-consists.json'), JSON.stringify(consists))
    fs.writeFileSync(path.join(__dirname, 'additional-data/metro-tracker/metro-types.json'), JSON.stringify(types))
    process.exit()
  })
})
