import fs from 'fs/promises'
import path from 'path'
import url from 'url'
import utils from '../utils.mjs'
import urls from '../urls.json' with { type: 'json' }

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let trainType = {
  'NS Comeng': 'Comeng',
  'SS Comeng': 'Comeng',
  'XTrapolis': 'Xtrapolis',
  'Siemens': 'Siemens'
}

const data = JSON.parse(await utils.request(urls.ptDatabaseMetro))
let validTrains = data
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

const parsedHCMT = JSON.parse(await utils.request(urls.ptDatabaseHCMT))
consists = consists.concat(parsedHCMT.map(train => {
  let rawTrain = [train.tc1, train.dmp1, train.mp1, train.dt1, train.dmp2, train.dt2, train.mp3, train.dmp3, train.tc2]
  return rawTrain.filter(x => x !== '-' && x)
})).reduce((acc, e) => ({
  ...acc,
  [e[0]]: e
}), {})

types = types.concat(parsedHCMT.map(train => ({
  leadingCar: train.tc1,
  type: 'HCMT'
}))).reduce((acc, e) => ({
  ...acc,
  [e.leadingCar]: e
}), {})

if (Object.keys(types).length > 0) {
  await fs.writeFile(path.join(__dirname, '../additional-data/metro-tracker/metro-consists.json'), JSON.stringify(consists))
  await fs.writeFile(path.join(__dirname, '../additional-data/metro-tracker/metro-types.json'), JSON.stringify(types))
}
process.exit()