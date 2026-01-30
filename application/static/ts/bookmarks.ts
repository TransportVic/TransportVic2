import { BOOKMARK_KEY, Page } from './types.js'
import { $ } from './util.js'

export type Mode = 'bus' | 'metro' | 'tram' | 'coach' | 'vline' | 'ferry' | 'unknown'

const cssNames: Record<Mode, string> = {
  bus: 'busStop',
  tram: 'tramStop',
  coach: 'regionalCoachStop',
  vline: 'vlineStation',
  metro: 'metroStation',
  ferry: 'ferryTerminal',
  unknown: 'unknown'
}

const iconNames: Record<Mode, string> = {
  bus: 'bus',
  tram: 'tram',
  coach: 'bus',
  vline: 'vline',
  metro: 'metro',
  ferry: 'ferry',
  unknown: 'unknown'
}

const stopTypes: Record<Mode, string> = {
  bus: 'Bus Stop',
  tram: 'Tram Stop',
  coach: 'Regional Coach Stop',
  vline: 'V/Line Train Station',
  metro: 'Metro Train Station',
  ferry: 'Ferry Terminal',
  unknown: 'unknown'
}

type BookmarkedStop = {
  id: string,
  stopName: string,
  suburb: string,
  modes: Mode[]
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
    const matchingStop = this.getBookmarkData().find(stop => stop.id === id)
    if (!matchingStop) return false
    return matchingStop.modes.includes(mode)
  }

  static addStopBookmark(id: string, stopName: string, suburb: string, mode: Mode) {
    const bookmarks = this.getBookmarkData()
    const matchingStop = bookmarks.find(stop => stop.id === id)
    if (matchingStop) {
      if (!matchingStop.modes.includes(mode)) matchingStop.modes.push(mode)
      return this.setBookmarkData(bookmarks)
    }

    bookmarks.push({
      id,
      stopName,
      suburb,
      modes: [ mode ]
    })

    this.setBookmarkData(bookmarks)
  }

  static removeStopBookmark(id: string, mode: string) {
    const bookmarks = this.getBookmarkData()
    const matchingStop = bookmarks.find(stop => stop.id === id)
    if (!matchingStop) return
    
    matchingStop.modes = matchingStop.modes.filter(m => m !== mode)
    this.setBookmarkData(bookmarks.filter(stop => stop.modes.length > 0))
  }

}

export class BookmarksPage extends Page {

  async load() {
    await this.replacePageData(await fetch('/bookmarks'))
  }

  setup() {
    const bookmarks = Bookmarks.getBookmarkData()
    const html = bookmarks.map(this.getStopHTML.bind(this)).join('')

    $('#results')!.innerHTML = html
  }

  getStopHTML(stop: BookmarkedStop): string {
    return stop.modes.map(mode => this.getStopHTMLForMode(stop, mode)).join('')
  }

  getStopLink(stop: BookmarkedStop, mode: Mode) {
    const parts = [ mode, 'timings' ]
    if (['bus', 'tram', 'regional coach'].includes(mode)) parts.push(stop.id)
    else {
      const primaryName = stop.id.split('/')[0]
      parts.push(primaryName.replace('-railway-station', ''))
    }

    return parts.join('/')
  }

  getStopHTMLForMode(stop: BookmarkedStop, mode: Mode) {
    return `
<a class="${cssNames[mode]} result" href="${this.getStopLink(stop, mode)}">
  <div class="leftContainer">
    <img src="/static/images/clear-icons/${iconNames[mode]}.svg">
  </div>
  <div class="resultDetails">
    <span>${stopTypes[mode]} in ${stop.suburb}</span>
    <span>${stop.stopName}</span>
  </div>
</a>
`
  }

  destroy() {}

}