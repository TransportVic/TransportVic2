$.ready(() => {
  $.ajax({
    url: '/home-banner'
  }, (err, status, body) => {
    let banner = $('.popup')

    if (err) {
      body = {
        link: '#',
        alt: 'Alert',
        text: 'Could not connect to server!'
      }
    }

    if (body.link) {
      banner.href = body.link
      $('img', banner).alt = body.alt
      $('span', banner).textContent = body.text

      banner.style = ''
    }
  })
})
