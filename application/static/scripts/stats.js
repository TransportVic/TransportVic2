$.ready(() => {
  let screenWidth = window.innerWidth
  let screenHeight = window.innerHeight

  let i = 0

  function createLayout(title) {
    let bgColour = (i++ % 2 == 0 ? '#2a2a2a' : '#202020')
    return {
      title,
      height: screenHeight,
      width: screenWidth,
      font: {
        family: 'Default-Font',
        size: 20,
        color: '#e8e8e8'
      },
      hoverlabel: {
        font: {
          family: 'Default-Font',
          size: 15,
          color: '#ffffff'
        }
      },
      plot_bgcolor: bgColour,
      paper_bgcolor: bgColour
    }
  }

  $.ajax({
    url: '/stats/gtfs-stats',
    method: 'GET'
  }, (err, status, content) => {
    let labels = Object.keys(content)
    let timeSpent = Object.values(content).map(d => d.loadTime / 1000)
    let objectCount = Object.values(content).map(d => d.datasize)

    Plotly.newPlot('timeSpent', [{
      values: timeSpent,
      labels,
      type: 'pie'
    }], createLayout('Time spent on each GTFS loader (seconds)'))

    Plotly.newPlot('percentageDocuments', [{
      values: objectCount,
      labels,
      type: 'pie'
    }], createLayout('Number of GTFS objects by type'))
  })

  let operators = {
    "V": "Ventura Bus Lines",
    "CO": "CDC Oakleigh",
    "CS": "CDC Sunshine",
    "CW": "CDC Wyndham",
    "CT": "CDC Tullamarine",
    "CG": "CDC Geelong",
    "CB": "CDC Ballarat",
    "T": "Kinetic",
    "S": "Sita Bus Lines",
    "D": "Dysons",
    "CR": "Cranbourne Transit",
    "SB": "Sunbury Bus Service",
    "LT": "Latrobe Valley Bus Lines",
    "MH": "McHarrys Bus Lines",
    "MK": "McKenzies Tourist Service",
    "MT": "Martyrs Bus Service",
    "RB": "Ryan Bros Bus Service",
    "ML": "Moreland Bus Lines",
    "MV": "Moonee Valley Bus Lines",
    "K": "Kastoria Bus Lines",
    "B": "Broadmeadows Bus Service",
    "RR": "Retired",
    "P": "Panorama Coaches",
    "CC": "Christians Bus Company (Bendigo)",
    "WM": "Whitemores Bus Lines"
  }

  $.ajax({
    url: '/stats/smartrak-stats',
    method: 'GET'
  }, (err, status, content) => {
    let operatorIDs = Object.keys(content)
    let labels = Object.keys(content).map(o => operators[o])
    let operatorCounts = Object.values(content)

    Plotly.newPlot('idsByOperator', [{
      x: labels,
      y: operatorCounts,
      type: 'bar',
      name: 'ID Count'
    }], createLayout('Known Smartrak IDs by operator'))
      //
      // Plotly.newPlot('operatorCompletion', [{
      //   x: labels,
      //   y: operatorCounts.map((count, i) => {
      //     return count / operatorSizes[operatorIDs[i]] * 100
      //   }),
      //   type: 'bar',
      //   name: 'Completed Smartrak IDs'
      // }, {
      //   x: labels,
      //   y: operatorCounts.map((count, i) => {
      //     return 100 - count / operatorSizes[operatorIDs[i]] * 100
      //   }),
      //   type: 'bar',
      //   name: 'Remaining Smartrak IDs'
      // }], Object.assign(createLayout('Smartrak ID completion by operator'), {
      //   barmode: 'stack'
      // }))
  })
})
