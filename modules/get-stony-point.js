const utils = require('../utils')

let allSprinters = []
for (let i = 7001; i <= 7022; i++) {
  if (i !== 7019) allSprinters.push(i.toString())
}

module.exports = async db => {
  let vlineTrips = db.getCollection('vline trips')
  let now = utils.now()
  let prevFriday = utils.now()
  prevFriday.day(prevFriday.day() >= 5 ? 5 : -2)

  let days = utils.allDaysBetweenDates(prevFriday, now).map(d => utils.getYYYYMMDD(d))

  let sprinters = (await vlineTrips.distinct('consist', {
    consist: /70\d\d/,
    date: {
      $in: days
    }
  })).sort((a, b) => a - b)

  let missing = allSprinters.filter(s => !sprinters.includes(s))
  return missing
}
