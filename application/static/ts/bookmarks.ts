import { BOOKMARK_KEY, Mode, modeCSSNames, modeHumanNames, modeIconNames, Page } from './types.js'
import { $ } from './util.js'

type BookmarkedStop = {
  id: string,
  stopName: string,
  suburb: string,
  mode: Mode
}

export class Bookmarks {

  static getBookmarkData(): BookmarkedStop[] {
    const data = localStorage.getItem(BOOKMARK_KEY)
    if (data) return JSON.parse(data) as BookmarkedStop[]
    return []
  }

  static setBookmarkData(data: BookmarkedStop[]) {
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(data))
  }

  static isStopBookmarked(id: string, mode: Mode) {
    return this.getBookmarkData().some(stop => stop.id === id && stop.mode === mode)
  }

  static addStopBookmark(id: string, stopName: string, suburb: string, mode: Mode) {
    const bookmarks = this.getBookmarkData()
    const matchingStop = bookmarks.find(stop => stop.id === id && stop.mode === mode)
    if (matchingStop) return

    bookmarks.push({
      id,
      stopName,
      suburb,
      mode
    })

    this.setBookmarkData(bookmarks)
  }

  static removeStopBookmark(id: string, mode: string) {
    const bookmarks = this.getBookmarkData()
    const matchingIndex = bookmarks.findIndex(stop => stop.id === id && stop.mode === mode)
    if (matchingIndex === -1) return
    
    this.setBookmarkData([
      ...bookmarks.slice(0, matchingIndex),
      ...bookmarks.slice(matchingIndex + 1)
    ])
  }

}

export class BookmarksPage extends Page {

  async load() {
    await this.replacePageData(await fetch('/bookmarks'))
  }

  setup() {
    const bookmarks = Bookmarks.getBookmarkData()
    if (!bookmarks.length) {
      const content = $('#content')!
      content.className = 'none'
      content.innerHTML = `
        <h2>Whoops... You've got nothing bookmarked</h2>
        <img src="/static/images/home/404.svg" />
        <div>
          <a href="/">Try going home</a>
          <span>&nbsp;Or&nbsp;</span>
          <a href="/search">Searching for a stop</a>
        </div>
      `
      return
    }

    const html = bookmarks.map(this.getStopHTML.bind(this)).join('')

    $('#results')!.innerHTML = html
  }

  getStopLink(stop: BookmarkedStop, mode: Mode) {
    const parts = [ mode, 'timings' ]
    if (['bus', 'tram', 'regional coach'].includes(mode)) parts.push(stop.id)
    else {
      const stopName = stop.id.split('/')[1]
      parts.push(stopName.replace('-railway-station', ''))
    }

    return parts.join('/')
  }

  getStopHTML(stop: BookmarkedStop) {
    const mode = stop.mode
    return `
<a class="${modeCSSNames[mode]} result" href="${this.getStopLink(stop, mode)}">
  <div class="leftContainer">
    <img src="/static/images/clear-icons/${modeIconNames[mode]}.svg">
  </div>
  <div class="resultDetails">
    <span>${modeHumanNames[mode]} in ${stop.suburb}</span>
    <span>${stop.stopName}</span>
  </div>
</a>
`
  }

  destroy() {}

}