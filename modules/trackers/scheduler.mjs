import utils from '../../utils.mjs'

export default function schedule(intervals, func, name, logger) {
  let minutesNow = utils.getMinutesPastMidnightNow()
  let currentInterval = intervals.find(i => {
    return i[0] <= minutesNow && minutesNow <= i[1]
  })

  if (currentInterval) {
    func()
    setTimeout(() => {
      module.exports(intervals, func, name, logger)
    }, currentInterval[2] * 60 * 1000)
  } else {
    let nextInterval = intervals.find(i => {
      return minutesNow < i[0]
    }) || intervals.find(i => {
      return minutesNow < i[0] + 1440
    })
    let timeToNextInterval = nextInterval[0] - minutesNow
    if (timeToNextInterval < 0) timeToNextInterval += 1440

    logger.info(name, 'sleeping for', timeToNextInterval, 'minutes')

    setTimeout(() => {
      func()
      setTimeout(() => {
        module.exports(intervals, func, name, logger)
      }, nextInterval[2] * 60 * 1000)
    }, timeToNextInterval * 60 * 1000)
  }
}
