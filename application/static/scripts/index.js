$.ready(() => {
  $.ajax({
    url: '/home-banner'
  }, (err, status, body) => {
    if (body.link) {
      let banner = $('.popup')

      banner.href = body.link
      $('img', banner).alt = body.alt
      $('span', banner).textContent = body.text

      banner.style = ''
    }
  })
})
