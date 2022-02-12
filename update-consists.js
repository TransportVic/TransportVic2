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
      consist: [train.mCarA, train.tCar, train.mCarB]
    }))
    .filter(train => !train.consist.includes('-'))

  let types = validTrains.map(train => ({
    leadingCar: train.consist[0],
    type: trainType[train.type]
  }))

  let consists = validTrains.map(train => train.consist)

  utils.request(urls.ptDatabaseHCMT).then(hcmtData => {
    let parsedHCMT = JSON.parse(hcmtData)
    consists = consists.concat(parsedHCMT.map(train => {
      let rawTrain = [train.TC1, train.DMP1, train.MP1, train.DT1, train.DMP2, train.DT2, train.MP3, train.DMP3, train.TC2]
      return rawTrain.filter(x => x !== '-' && x)
    }))

    types = types.concat(parsedHCMT.map(train => ({
      leadingCar: train.TC1,
      type: 'HCMT'
    })))

    fs.writeFileSync(path.join(__dirname, 'additional-data/metro-tracker/metro-consists.json'), JSON.stringify(consists))
    fs.writeFileSync(path.join(__dirname, 'additional-data/metro-tracker/metro-types.json'), JSON.stringify(types))
    process.exit()
  })
})
