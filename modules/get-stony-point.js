const utils = require('../utils')

function getPreviousDay(day, dayOfWeek) {
  for (let i = 0; i <= 7; i++) {
    let checkDay = day.clone().add(-i, 'days')
    if (utils.getDayOfWeek(checkDay) === dayOfWeek) return checkDay
  }
}

async function getMissingTrains(onDay, untilDay, vlineTrips, allSprinters) {
  let days = utils.allDaysBetweenDates(untilDay, onDay).map(d => utils.getYYYYMMDD(d))

  let sprinters = await vlineTrips.distinct('consist', {
    consist: /70\d\d/,
    date: {
      $in: days
    }
  })

  return allSprinters.filter(s => !sprinters.includes(s))
}

function getRotationStart(fromDay) {
  let currentDay = utils.getDayOfWeek(fromDay)

  if (!utils.isWeekday(currentDay) || currentDay === 'Fri') {
    return getPreviousDay(fromDay, 'Fri')
  } else {
    return getPreviousDay(fromDay, 'Mon')
  }
}

module.exports = async db => {
  let vlineTrips = db.getCollection('vline trips')

  let now = utils.now()
  let recentSprinters = (await vlineTrips.distinct('consist', {
    consist: /70\d\d/,
    date: {
      $in: utils.allDaysBetweenDates(now.clone().add(-14, 'days'), now)
        .map(d => utils.getYYYYMMDD(d))
    }
  })).sort((a, b) => a - b)

  let untilDay = getRotationStart(now)
  let previousRotationStart = untilDay.clone()

  let previous2Missing = []
  for (let i = 0; i < 2; i++) {
    let previousRotationEnd = previousRotationStart.clone().add(-1, 'day')
    previousRotationStart = getRotationStart(previousRotationEnd)

    previous2Missing[i] = await getMissingTrains(previousRotationEnd, previousRotationStart, vlineTrips, recentSprinters)
  }

  let missingBoth = previous2Missing[0].filter(train => previous2Missing[1].includes(train))
  let currentRotationMissing = await getMissingTrains(now, untilDay, vlineTrips, recentSprinters)

  let potential = currentRotationMissing.filter(train => !missingBoth.includes(train) && !previous2Missing[0].includes(train))

  if (potential.length === 2) return potential
  else if (potential.length > 2) {
    let previousRotationEnd = untilDay.clone().add(-1, 'day')

    for (let check of potential) {
      let pairedWith = await vlineTrips.findDocuments({
        consist: check,
        date: utils.getYYYYMMDD(previousRotationEnd)
      }).sort({ departureTime: -1 }).limit(1).next()

      if (pairedWith && pairedWith.consist.length >= 2) {
        let alsoMissing = pairedWith.consist.filter(train => potential.includes(train) && train !== check)
        if (alsoMissing.length === 1) {
          let checkIndex = pairedWith.consist.indexOf(check)
          let otherIndex = pairedWith.consist.indexOf(alsoMissing[0])

          if (Math.abs(checkIndex - otherIndex) === 1) return [check, alsoMissing[0]]
        }
      }
    }
  }

  return potential
}
