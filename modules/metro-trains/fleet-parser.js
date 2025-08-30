module.exports.parseConsist = function parseConsist(consist, metroConsists) {
  return module.exports.parseConsistFromMotors(module.exports.getMotorVehicles(consist), metroConsists)
}

module.exports.parseConsistFromMotors = function parseConsist(motorVehicles, metroConsists) {
  if (!motorVehicles.length) return null
  let leadingVehicles = module.exports.getLeadingVehicles(motorVehicles)
  return leadingVehicles.map(vehicle => metroConsists[vehicle]).filter(Boolean)
}

module.exports.getMotorVehicles = function getMotorVehicles(consist) {
  let carriages = consist.split('-')
  if (carriages[0].match(/^\d{4}M$/)) { // New format consists
    return carriages.map(carriages => carriages.slice(0, -1))
  } 
  return carriages.filter(carriage => carriage.match(/^\d+M$/))
}

module.exports.getLeadingVehicles = function getLeadingVehicles(motorVehicles) {
  if (!motorVehicles.length) return []
  if (motorVehicles[0].match(/^\d{4}$/)) return [ motorVehicles[0] ]
  if (motorVehicles[0].match(/^\d{4}M$/)) return [ motorVehicles[0].slice(0, -1) ]

  let mCars = motorVehicles.filter(carriage => carriage.match(/(\d+)/)).map(carriage => ({
    number: parseInt(carriage.match(/(\d+)/)[1]),
    carriage,
    matched: false
  })).sort((a, b) => a.number - b.number)

  let leadingVehicles = []
  for (let i = 0; i < mCars.length - 1; i++) {
    let { number, carriage } = mCars[i]
    let nextNumber = mCars[i + 1].number
    if ((number % 2 === 1) && (nextNumber === number + 1)) {
      leadingVehicles.push(carriage)
      mCars[i].matched = mCars[i + 1].matched = true
      i++
    }
  }

  let unmatched = mCars.filter(car => !car.matched)
  if (unmatched.length === 2) leadingVehicles.push(unmatched[0].carriage)
  else if (unmatched.length === 4) leadingVehicles = motorVehicles

  return leadingVehicles
}