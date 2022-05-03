const utils = require('./utils')

let dstBlocks = []
let nonDSTBlocks = []

let now = utils.now()
let yearAgo = now.clone().add(-1, 'year')

let getDSTStartForYear = year => year.clone().startOf('year').set('month', 9).startOf('isoWeek').add(6, 'days')
let getDSTEndForYear = dstStartDate => dstStartDate.clone().add(1, 'year').startOf('year').set('month', 3).startOf('isoWeek').add(6, 'days')

let dstStartLastYear = getDSTStartForYear(yearAgo)
let dstEndLastYear = getDSTEndForYear(dstStartLastYear)

dstBlocks.push({
  isDST: true,
  start: dstStartLastYear,
  end: dstEndLastYear
})

for (let i = 1; i <= 2; i++) {
  let latestDSTBlock = dstBlocks[dstBlocks.length - 1]
  let dstBlockEnd = latestDSTBlock.end
  let blockYearDSTStart = getDSTStartForYear(dstBlockEnd)
  let blockYearDSTEnd = getDSTEndForYear(blockYearDSTStart)

  dstBlocks.push({
    isDST: true,
    start: blockYearDSTStart,
    end: blockYearDSTEnd
  })
}

for (let i = 1; i < dstBlocks.length; i++) {
  let previousBlock = dstBlocks[i - 1]
  let currentBlock = dstBlocks[i]

  let nonDSTStart = previousBlock.end.clone().add(1, 'day')
  let nonDSTEnd = currentBlock.start.clone().add(-1, 'day')

  nonDSTBlocks.push({
    isDST: false,
    start: nonDSTStart,
    end: nonDSTEnd
  })
}

module.exports = dstBlocks.concat(nonDSTBlocks).sort((a, b) => a.start - b.start).filter(block => now < block.end).map(block => {
  return {
    isDST: block.isDST,
    start: utils.getYYYYMMDD(block.start),
    end: utils.getYYYYMMDD(block.end)
  }
})
