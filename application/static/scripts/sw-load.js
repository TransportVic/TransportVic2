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
