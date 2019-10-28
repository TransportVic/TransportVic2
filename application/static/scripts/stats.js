$.ready(() => {
  let screenWidth = window.innerWidth
  let screenHeight = window.innerHeight

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
    }], {
      title: 'Time spent on each GTFS loader',
      height: screenHeight,
      width: screenWidth,
      font: {
        family: 'BreeSerif',
        size: 20,
        color: '#3c3c3c'
      }
    })

    Plotly.newPlot('percentageDocuments', [{
      values: objectCount,
      labels,
      type: 'pie'
    }], {
      title: 'Number of GTFS objects by type',
      height: screenHeight,
      width: screenWidth,
      font: {
        family: 'BreeSerif',
        size: 20,
        color: '#3c3c3c'
      }
    })
  })

  let operators = {
    "V": "Ventura",
    "CO": "CDC Oakleigh",
    "CS": "CDC Sunshine",
    "CW": "CDC Wyndham",
    "T": "Transdev",
    "S": "Sita",
    "D": "Dysons",
    "CT": "Cranbourne Transit",
    "SB": "Sunbury"
  }

  let operatorSizes = {
    "V": 885,
    "CO": 87,
    "CS": 68,
    "CW": 170,
    "T": 564,
    "S": 97,
    "D": 261,
    "CT": 81,
    "SB": 63
  }

  $.ajax({
    url: '/stats/smartrak-stats',
    method: 'GET'
  }, (err, status, content) => {
    let operatorIDs = Object.keys(content)
    let labels = Object.keys(content).map(o => operators[o])
    let operatorCounts = Object.values(content)

    Plotly.newPlot('idsByOperator', [{
      values: operatorCounts,
      labels,
      type: 'pie'
    }], {
      title: 'Known Smartrak IDs by operator',
      height: screenHeight,
      width: screenWidth,
      font: {
        family: 'BreeSerif',
        size: 20,
        color: '#3c3c3c'
      }
    })

    Plotly.newPlot('operatorCompletion', [{
      x: labels,
      y: operatorCounts.map((count, i) => {
        return count / operatorSizes[operatorIDs[i]] * 100
      }),
      type: 'bar',
      name: 'Completed Smartrak IDs'
    }, {
      x: labels,
      y: operatorCounts.map((count, i) => {
        return 100 - count / operatorSizes[operatorIDs[i]] * 100
      }),
      type: 'bar',
      name: 'Remaining Smartrak IDs'
    }], {
      title: 'Smartrak ID completion by operator',
      height: screenHeight,
      width: screenWidth,
      font: {
        family: 'BreeSerif',
        size: 20,
        color: '#3c3c3c'
      },
      barmode: 'stack'
    })
  })
})
