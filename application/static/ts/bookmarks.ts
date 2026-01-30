import { BOOKMARK_KEY } from './types.js'

export type Mode = 'bus' | 'metro' | 'tram' | 'coach' | 'vline' | 'ferry' | 'unknown'

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