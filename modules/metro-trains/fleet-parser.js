const metroConsists = require('../../additional-data/metro-tracker/metro-consists')

function findConsist(consist, runID) {
  let finalConsist = []
  if (!consist) return null

  // POTS Ghost Train
  if (consist.match(/train\d+/)) {
    return global.loggers.trackers.metro.warn('Encountered strange train', {
      consist,
      runID
    })
  }

  let carriages = consist.split('-')

  if (carriages[0].match(/9\d{3}M/)) {
    let leadingNumber = carriages[0].slice(0, 4)
    let hcmtSet = metroConsists.find(set => set.includes(leadingNumber))

    finalConsist = hcmtSet
  } else if (consist.includes('M')) {
    if (carriages.includes('313M') || carriages.includes('333M')) { // 313-333 withdrawn, replaced by 314-334
      let exclude = ['333M', '313M', '314M', '334M', '1007T', '1017T']
      carriages = carriages.filter(carriage => !exclude.includes(carriage))
      carriages = ['1017T', ...carriages, '314M', '334M']
    }

    if (carriages.includes('330M') || carriages.includes('350M') || carriages.includes('691M') || carriages.includes('692M')) { // 691-692 withdrawn, replaced by 330-350
      let exclude = ['330M', '350M', '691M', '692M', '1025T', '1196T']
      carriages = carriages.filter(carriage => !exclude.includes(carriage))
      carriages = ['1025T', ...carriages, '330M', '350M']
    }

    if (carriages.includes('527M') || carriages.includes('528M')) { // 695-696 withdrawn, replaced by 527-528
      let exclude = ['527M', '528M', '695M', '696M', '1114T', '1198T']
      carriages = carriages.filter(carriage => !exclude.includes(carriage))
      carriages = ['1114T', ...carriages, '527M', '528M']
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

        let otherCars = carriages.filter(carriage => !mtmMatched.includes(carriage))
        let otherCarFull = metroConsists.find(consist => consist.includes(otherCars[0]))
        if (otherCarFull) {
          finalConsist = finalConsist.concat(otherCarFull)
        }
      } else {
        finalConsist = carriages
      }
    }
  }

  if (finalConsist.length) {
    return finalConsist
  }
}

module.exports = findConsist
