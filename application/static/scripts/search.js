$.ready(() => {
  $.inputTimeout($('#textbar'), query => {
    $('#loading').style = 'display: block;'
    $.ajax({
      url: '/search',
      method: 'POST',
      data: { query }
    }, (err, status, content) => {
      $('#loading').style = 'display: none;'
      $('#search-results').innerHTML = content
    })
  })
})
