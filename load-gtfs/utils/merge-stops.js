function hash(stops) {
  return stops.reduce((a, e) => a * e.stopGTFSID, 1)
}

function l(m) { return m.slice(-1)[0] }

module.exports = function merge(inputVariants, matched) {
  inputVariants = inputVariants.sort((a, b) => {
    return b.length - a.length || l(a).stopName.length - l(b).stopName.length || hash(a) - hash(b)
  })

  let loopVariants = inputVariants.filter(variant => {
    return variant[0].stopName === l(variant).stopName && variant.length > 1
  })

  let distinctTerminusVariants = inputVariants.filter(variant => {
    return !loopVariants.includes(variant)
  })

  // Process loop variants first in the hope that the non loop variants can come along later and add in the distinct terminus for the route
  let variants = loopVariants.concat(distinctTerminusVariants)

  let hasLoopVariants = loopVariants.length > 0

  stopsList = variants[0]
  branch = []

  let origin = stopsList[0]

  variants.slice(1).forEach(variant => {
    let lastMainMatch = 0
    let isLoopVariant = variant[0].stopName === l(variant).stopName

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

            let branchEnd = branch.slice(-1)[0]

            let firstHalf = stopsList.slice(0, matchIndex - offset)
            let backHalf = stopsList.slice(matchIndex - offset)

            if (matched(branchEnd, origin)) {
              stopsList = firstHalf.concat(backHalf).concat(branch)
            } else {
              stopsList = firstHalf.concat(branch).concat(backHalf)
            }

            origin = stopsList[0]

            branch = []
          } else { // otherwise we're on sync, all good
            if (matchIndex < lastMainMatch) {
              let jumpPart = variant.slice(matchIndex, lastMainMatch)
              let subBranch = []
              for (let jumpStop of jumpPart) {
                if (matched(jumpStop, variantStop)) break
                subBranch.push(jumpStop)
              }
              branch = branch.concat(subBranch)
            }
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

      let firstHalf = stopsList.slice(0, lastMainMatch + 1)
      let backHalf = stopsList.slice(lastMainMatch + 1)

      if (hasLoopVariants && !isLoopVariant) {
        stopsList = stopsList.concat(branch)
      } else {
        stopsList = firstHalf.concat(branch).concat(backHalf)
      }

      branchEnd = stopsList[0]

      branch = []
    }
  })

  return stopsList
}
