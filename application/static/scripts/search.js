$.ready(() => {
  $.inputTimeout($('#textbar'), query => {
    $.ajax({
      url: '/search',
      method: 'POST',
      data: { query }
    }, (err, status, content) => {
      $('#search-results').innerHTML = content
    })
  })
})
