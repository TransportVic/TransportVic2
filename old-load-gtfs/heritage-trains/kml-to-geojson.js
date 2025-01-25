const cheerio = require('cheerio')
const async = require('async')
const turf = require('@turf/turf')
const fs = require('fs')

let coordinateSearch = 'LineString > coordinates'

let input = process.argv[2]
let output = process.argv[3]

let reverse = process.argv[4] === 'reverse'

let inputKML = fs.readFileSync(input).toString()

function match(allCoords) {
  return allCoords.text().split(/[\n ]+/).filter(Boolean).map(cpair => cpair.split(',').slice(0, 2).map(coord => parseFloat(coord)))
}

let $ = cheerio.load(inputKML)
let coordinates = match($(coordinateSearch))

if (reverse) coordinates.reverse()

fs.writeFileSync(output, JSON.stringify({
  type: 'LineString',
  coordinates
}))
