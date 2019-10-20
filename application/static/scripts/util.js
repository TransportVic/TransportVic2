HTMLElement.prototype.on = HTMLElement.prototype.addEventListener
Window.prototype.on = Window.prototype.addEventListener

Object.defineProperty(XMLHttpRequest.prototype, 'responseJSON', {
  get: function () {
    try {
      return JSON.parse(this.responseText)
    } catch (e) {
      return undefined
    }
  },
  enumerable: false
})

function $ (query, elem) {
  if (elem) return elem.querySelector(query)
  return document.querySelector(query)
}

$.delete = function (query) {
  if ($(query)) { $(query).parentElement.removeChild($(query)) }
}

// consider using fetch in future
$.ajax = function (options, callback) {
  var xhr = new XMLHttpRequest()
  xhr.addEventListener('load', function () {
    callback(null, xhr.status, xhr.responseJSON || xhr.responseXML || xhr.responseText)
  })

  xhr.addEventListener('error', function (err) {
    callback(err, xhr.status, null)
  })

  xhr.open(options.method || 'GET', options.url || location.toString())
  if (options.data) {
    xhr.setRequestHeader('Content-Type', 'application/json')
  }
  xhr.send(JSON.stringify(options.data))
}

$.ready = function (callback) {
  if (document.readyState !== 'loading') { setTimeout(callback, 0) } else { document.addEventListener('DOMContentLoaded', callback) }
}

var query = location.query

window.search = {}

search.hash = (location.hash.match(/#(\w+[=]\w+&?)+/) || []).slice(1).map(e => e.split('=')).reduce((a, e) => { a[e[0]] = e[1]; return a }, {})
search.query = (location.search.match(/\?(\w+[=]\w+&?)+/) || []).slice(1).map(e => e.split('=')).reduce((a, e) => { a[e[0]] = e[1]; return a }, {})

$.ready(() => {
  if (navigator.userAgent.toLowerCase().includes('mobile')) {
    window.scrollTo(0, 0)

    const height = window.innerHeight
    const width = window.innerWidth
    $('meta[name=viewport]').setAttribute('content', `initial-scale=1.0, maximum-scale=1.0, user-scalable=no, width=${width}px, height=${height}px`)
  }
})

$.inputTimeout = function (element, callback) {
  let timeoutID = 0

  element.on('input', () => {
    clearTimeout(timeoutID)
    timeoutID = setTimeout(callback, 850, element.value)
  })
}

$.isPWA = function () {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone == true
}
