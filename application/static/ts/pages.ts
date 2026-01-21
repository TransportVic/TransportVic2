import { Page, PageState } from './types.js'
import { $, inputTimeout } from './util.js'

type SearchPageState = PageState & {
  searchQuery: string
  searchResults: string
}

type NearbyPageState = PageState & {
  nearbyResults: string
}

export class SearchPage extends Page {

  private searchID: number = 0
  protected state: SearchPageState = {
    header: '',
    content: '',
    styles: [],
    searchQuery: '',
    searchResults: ''
  }

  async load(): Promise<any> {
    await this.replacePageData(await fetch('/search'))
  }

  setup(): void {
    inputTimeout($('#textbar') as HTMLInputElement, this.performSearch.bind(this))
  }

  async performSearch() {
    const currentSearchID = ++this.searchID
    const query = ($('#textbar') as HTMLInputElement).value

    $('#loading')!.style = 'display: block;'
    const searchResults = await (await fetch('/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    })).text()

    // Out of date
    if (currentSearchID !== this.searchID) return

    $('#loading')!.style = 'display: none;'
    this.setSearchResults(searchResults)
    this.updateState(query, searchResults)
  }

  setSearchResults(searchResults: string) {
    $('#search-results')!.innerHTML = searchResults
  }

  updateState(query: string, searchResults: string) {
    this.state.searchQuery = query
    this.state.searchResults = searchResults

    super.replacePageState()
  }

  destroy() {}

  restore() {
    super.restore();

    ($('#textbar') as HTMLInputElement).value = this.state.searchQuery;
    $('#search-results')!.innerHTML = this.state.searchResults;
  }

}

export class NearbyPage extends Page {

  static UPDATE_INTERVAL: number = 5000

  private watchID: number = 0

  async load(): Promise<any> {
    await this.replacePageData(await fetch('/nearby'))
  }

  setup(): void {
    this.watchID = window.navigator.geolocation.watchPosition(
      this.processPosition.bind(this),
      this.processError.bind(this), {
      enableHighAccuracy: true,
      maximumAge: NearbyPage.UPDATE_INTERVAL
    })
  }

  async processPosition(position: GeolocationPosition) {
    const { coords } = position
    const { latitude, longitude } = coords

    const nearbyResults = await (await fetch('/nearby', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude, longitude
      })
    })).text()

    $('#content')!.innerHTML = nearbyResults
  }

  processError(error: GeolocationPositionError) {

  }

  destroy() {
    window.navigator.geolocation.clearWatch(this.watchID)
  }

}