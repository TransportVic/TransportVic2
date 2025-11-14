if (!location.hostname.match(/.*\..*\.transportvic\.me/)) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(registration => {
      console.log('Service Worker Registered')
    })

    navigator.serviceWorker.ready.then(registration => {
      console.log('Service Worker Ready')
    })
  }
}

$.ajax({
  url: '/cf-challenge-test'
}, (err, status, body) => {
  if (status === 403) window.location.href = `/cf-challenge?u=${location.href}`
})