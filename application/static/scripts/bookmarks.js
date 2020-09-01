function getBookmarks() {
  let bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]')

  bookmarks = bookmarks.filter(e => e.modes.length > 0 && e.id !== 'undefined/undefined')
  localStorage.setItem('bookmarks', JSON.stringify(bookmarks))

  return bookmarks
}

let cssNames = {
  bus: 'busStop',
  tram: 'tramStop',
  'regional coach': 'regionalCoachStop',
  'regional train': 'vlineStation',
  'metro train': 'metroStation',
  ferry: 'ferryTerminal',
  'heritage train': 'heritageStation'
}

let iconNames = {
  bus: 'bus',
  tram: 'tram',
  'regional coach': 'bus',
  'regional train': 'vline',
  'metro train': 'metro',
  ferry: 'ferry',
  'heritage train': 'vline'
}

let linkNames = {
  bus: 'bus',
  tram: 'tram',
  'regional coach': 'coach',
  'regional train': 'vline',
  'metro train': 'metro',
  ferry: 'ferry',
  'heritage train': 'heritage'
}

let stopTypes = {
  bus: 'Bus Stop',
  tram: 'Tram Stop',
  'regional coach': 'Regional Coach Stop',
  'regional train': 'V/Line Train Station',
  'metro train': 'Metro Train Station',
  ferry: 'Ferry Terminal',
  'heritage train': 'Heritage Train Station'
}

$.ready(() => {
  let html = ''
  let bookmarks = getBookmarks().reverse()

  let bookmarked = 0

  bookmarks.forEach(bookmark => {
    let {stopData} = bookmark
    bookmark.modes.reverse().forEach(mode => {
      bookmarked++

      let link = `/${linkNames[mode]}/timings`
      if (['bus', 'tram'].includes(mode)) {
        link += `/${stopData.codedSuburb}`
      }
      if (['metro train', 'regional train', 'heritage train'].includes(mode))
        link += `/${stopData.codedName.slice(0, -16)}`
      else
        link += `/${stopData.codedName}`

      html += `
<a class="${cssNames[mode]} result" href="${link}">
  <div class="leftContainer">
    <img src="/static/images/clear-icons/${iconNames[mode]}.svg">
  </div>
  <div class="resultDetails">
    <span>${stopTypes[mode]} in ${stopData.suburb}</span>
    <span>${stopData.stopName}</span>
  </div>
</a>
`
    })
  })

  if (!bookmarked) {
    $('#content').className = 'none'
    $('#content').innerHTML = `
<h2>Whoops... You've got nothing bookmarked</h2>
<img src="/static/images/home/404.svg" />
<div>
  <a href="/">Try going home</a>
  <span>&nbsp;Or&nbsp;</span>
  <a href="/search">Searching for a stop</a>
</div>
    `
  } else {
    $('#results').innerHTML = html
  }
})
