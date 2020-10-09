const metroConsists = require('./additional-data/metro-tracker/metro-consists')
let finalConsist=[]
let consist='1061T-333M-334M-421M-422M'
let carriages = consist.split('-')

if (carriages.includes('333M')) {
  let exclude = ['333M', '334M', '1017T']
  carriages = carriages.filter(carriage => !exclude.includes(carriage))
  carriages = ['1017T', ...carriages, '314M', '334M']
}

if (carriages.length <= 2) {
  finalConsist = metroConsists.filter(consist => carriages.some(carriage => consist.includes(carriage))).reduce((a, e) => {
    return a.concat(e)
  }, [])
} else {
  let mCars = carriages.filter(carriage => carriage.endsWith('M'))
  let tCars = carriages.filter(carriage => carriage.endsWith('T'))
  let mCarNumbers = mCars.map(carriage => parseInt(carriage.slice(0, -1)))
  let anyPair = mCarNumbers.find(carriage => {
    // Only consider odd carriage as lower & find if it has + 1
    return (carriage % 2 === 1) && mCarNumbers.some(other => other == carriage + 1)
  })

  let mtmMatched
  if (anyPair) {
    mtmMatched = metroConsists.find(consist => consist.includes(anyPair + 'M'))
  } else {
    let consistFromTCars = tCars.map(tCar => metroConsists.find(consist => consist.includes(tCar)))
    mtmMatched = consistFromTCars.find(potentialConsist => {
      return mCars.includes(potentialConsist[0]) && mCars.includes(potentialConsist[2])
    })
  }

  if (mtmMatched) {
    finalConsist = finalConsist.concat(mtmMatched)

    if (carriages.length === 6) {
      let tCarMatched = mtmMatched[1]
      let otherCars = carriages.filter(carriage => !mtmMatched.includes(carriage))
      let otherConsist = [otherCars[1], otherCars[0], otherCars[2]]
      finalConsist = finalConsist.concat(otherConsist)
    }
  } else {
    finalConsist = carriages
  }
}
console.log(finalConsist)
