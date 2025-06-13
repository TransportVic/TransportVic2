module.exports.parseConsist = function parseConsist(consist, metroConsists) {

}

module.exports.getLeadingVehicles =  function getLeadingVehicles(consist) {
  let carriages = consist.split('-')
  if (carriages[0].match(/9\d{3}M/)) { // HCMT
    return [ carriages[0].slice(0, 4) ]
  } else if (consist.includes('M')) {
    let mCars = carriages.filter(carriage => carriage.endsWith('M')).map(carriage => ({
      number: parseInt(carriage.slice(0, -1)),
      carriage
    })).sort((a, b) => a.number - b.number)
    let leadingVehicles = []
    for (let i = 0; i < mCars.length - 1; i++) {
      let { number, carriage } = mCars[i]
      let nextNumber = mCars[i + 1].number
      if ((number % 2 === 1) && (nextNumber === number + 1)) {
        leadingVehicles.push(carriage)
        i++
      }
    }
    return leadingVehicles
  }
}