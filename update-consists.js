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

utils.request(urls.ptDatabase).then(data => {
  let parsed = JSON.parse(data)
  let consists = parsed.map(train => [train.mCarA, train.tCar, train.mCarB])
  let types = parsed.map(train => ({
    leadingCar: train.mCarA,
    type: trainType[train.trainType]
  }))

  fs.writeFile(path.join(__dirname, 'additional-data/metro-tracker/metro-consists.json'), JSON.stringify(consists), () => {})
  fs.writeFile(path.join(__dirname, 'additional-data/metro-tracker/metro-types.json'), JSON.stringify(types), () => {})
})
