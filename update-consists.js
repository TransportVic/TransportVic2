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
  let consists = parsed.map(train => [train.mCarA, train.tCar, train.mCarB])
  let types = parsed.map(train => ({
    leadingCar: train.mCarA,
    type: trainType[train.trainType]
  }))

  utils.request(urls.ptDatabaseHCMT).then(hcmtData => {
    let parsedHCMT = JSON.parse(hcmtData)
    consists = consists.concat(parsedHCMT.map(train => {
      let rawTrain = [train.TC1, train.DMP1, train.MP1, train.DT1, train.DMP2, train.DT2, train.MP3, train.DMP3, train.TC2]
      return rawTrain.filter(x => x !== '-')
    }))

    types = types.concat(parsedHCMT.map(train => ({
      leadingCar: train.TC1,
      type: 'HCMT'
    })))

    fs.writeFile(path.join(__dirname, 'additional-data/metro-tracker/metro-consists.json'), JSON.stringify(consists), () => {})
    fs.writeFile(path.join(__dirname, 'additional-data/metro-tracker/metro-types.json'), JSON.stringify(types), () => {})
  })
})
