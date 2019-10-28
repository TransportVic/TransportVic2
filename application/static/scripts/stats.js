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
      title: 'Time spent on each GTFS loader',
      values: timeSpent,
      labels,
      type: 'pie'
    }], {
      height: innerHeight,
      width: innerWidth,
      font: {
        family: 'BreeSerif',
        size: 20,
        color: '#3c3c3c'
      }
    })

    Plotly.newPlot('percentageDocuments', [{
      title: 'Number of GTFS objects by type',
      values: objectCount,
      labels,
      type: 'pie'
    }], {
      height: innerHeight,
      width: innerWidth,
      font: {
        family: 'BreeSerif',
        size: 20,
        color: '#3c3c3c'
      }
    })
  })
})
