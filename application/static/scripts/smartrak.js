$.ready(() => {
  $('#submit').on('click', () => {
    $.ajax({
      url: '/smartrak/load',
      method: 'POST',
      data: {
        content: $('#textbar').value
      }
    }, (err, status, content) => {
      alert(content)
    })
  })
})
