const utils = require('../../utils')

module.exports = function schedule(intervals) {
  let minutesNow = utils.getMinutesPastMidnightNow()
  let currentInterval = intervals.find(i => {
    return i[0] <= minutesNow && minutesNow <= i[1]
  })

  if (currentInterval) {
    return currentInterval[2]
  } else {
    return 0
  }
}
