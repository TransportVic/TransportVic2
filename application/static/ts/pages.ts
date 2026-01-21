import { BASE_STATE, Page, PageState } from './types.js'
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
    ...BASE_STATE,
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

  private static UPDATE_INTERVAL: number = 5000
  private static ERROR_MESSAGES: Record<number, string> = {
    0: 'Whoops! Something went wrong and I can\'t find your location!',
    1: 'Please accept the location prompt!',
    2: 'Whoops! Something went wrong and I can\'t find your location!',
    3: 'Whoops! Finding your location took too long!'
  }

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
    const content = $('#content')!
    const message = NearbyPage.ERROR_MESSAGES[error.code] || NearbyPage.ERROR_MESSAGES[0]

    content.className = 'none'
    content.innerHTML = `
  <h2>${message}</h2>
  <img src="/static/images/home/500.svg" />
  <div>
    <a href="/">Try going home</a>
    <span>&nbspOr&nbsp</span>
    <a href="/search">Searching for a stop</a>
  </div>`
  }

  destroy() {
    window.navigator.geolocation.clearWatch(this.watchID)
  }

}