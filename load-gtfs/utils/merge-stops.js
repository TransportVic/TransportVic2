module.exports = function merge(variants, matched) {
  variants = variants.sort((a, b) => b.length - a.length)

  stopsList = variants[0]
  branch = []

  variants.slice(1).forEach(variant => {
    let lastMainMatch = 0

    let stopIndex = -1
    for (let variantStop of variant) {
      stopIndex++

      let matchIndex = -1

      let hasMatched = false
      for (let stop of stopsList) {
        matchIndex++

        if (hasMatched = matched(stop, variantStop)) {
          if (branch.length > 0) { // lines are out of sync, but match detected = rejoining
            let mainBranchLength = matchIndex - lastMainMatch
            let offset = 0

            if (mainBranchLength < branch.length)
              offset = mainBranchLength

            let firstHalf = stopsList.slice(0, matchIndex - offset)
            let backHalf = stopsList.slice(matchIndex - offset)
            stopsList = firstHalf.concat(branch).concat(backHalf)

            branch = []
          } else { // otherwise we're on sync, all good
            lastMainMatch = matchIndex
          }
          break
        }
      }

      if (!hasMatched) {
        // no match, we're on a branch
        branch.push(variantStop)
      }
    }

    if (branch.length) { // we're still on a branch after completing the stops, means they have different destiantions
      // look at where they deviated, and join it in between

      let firstHalf = stopsList.slice(0, lastMainMatch)
      let backHalf = stopsList.slice(lastMainMatch + branch.length + 1)

      stopsList = firstHalf.concat(branch).concat(backHalf)
      branch = []
    }
  })

  return stopsList
}
