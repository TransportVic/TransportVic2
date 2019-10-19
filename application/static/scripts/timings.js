$.ready(() => {
  const htmlData = $('#departures').innerHTML

  function filterRuns(query) {
    $('#departures').innerHTML = htmlData
    Array.from($('#departures').querySelectorAll('.departure')).forEach(departureDiv => {
      const stopsAt = departureDiv.querySelector('[name=stops-at]').value.toLowerCase().split(',')
      const platform = departureDiv.querySelector('[name=platform]').value.toLowerCase()
      const line = departureDiv.querySelector('[name=line]').value.toLowerCase()

      let platformNumber = (platform.match(/(\d+)/) || ['', ''])[1]
      let platformEnd = (platform.match(/\d+([A-Za-z])$/) || ['', ''])[1]

      let platformMatches = query === platformNumber ||
        (platformEnd ? platform.startsWith(query.toLowerCase()) : false)

      if (!(stopsAt.filter(stop => stop.includes(query)).length || platformMatches || line.includes(query))) $('#departures').removeChild(departureDiv)
    })
  }

  $('#textbar').on('input', () => {
    filterRuns($('#textbar').value.toLowerCase())
  })
})
