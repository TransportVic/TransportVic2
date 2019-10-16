$.ready(() => {
  const htmlData = $('#departures').innerHTML

  function filterRuns(query) {
    $('#departures').innerHTML = htmlData
    Array.from($('#departures').querySelectorAll('.departure')).forEach(departureDiv => {
      const stopsAt = departureDiv.querySelector('[name=stops-at]').value.toLowerCase().split(',')
      const platform = departureDiv.querySelector('[name=platform]').value.toLowerCase()
      const line = departureDiv.querySelector('[name=line]').value.toLowerCase()

      if (!(stopsAt.filter(stop => stop.includes(query)).length || platform.startsWith(query) || line.includes(query))) $('#departures').removeChild(departureDiv)
    })
  }

  $('#textbar').on('input', () => {
    filterRuns($('#textbar').value.toLowerCase())
  })
})
