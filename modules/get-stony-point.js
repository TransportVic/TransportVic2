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
      let pairedWith = await vlineTrips.distinct('consist', {
        consist: check,
        date: utils.getYYYYMMDD(previousRotationEnd)
      })

      if (pairedWith.length === 2 && pairedWith.some(train => potential.includes(train))) {
        return pairedWith
      }
    }
  }

  return potential
}
