setInterval(() => {
  $.ajax({
    method: 'POST'
  }, (err, status, body) => {
    $('body').innerHTML = body
  })
}, 1000 * 30)
