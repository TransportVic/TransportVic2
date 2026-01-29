import { BASE_STATE, Page, PageState } from './types.js'
import { $, inputTimeout } from './util.js'

type SearchPageState = PageState & {
  searchQuery: string
  searchResults: string
}

type NearbyPageState = PageState & {
  nearbyResults: string
}

type IndexPageState = PageState & {
  banner: BannerData
}

type BannerData = {
  link: string,
  alt: string,
  text: string
}

export class IndexPage extends Page {

  protected state: IndexPageState = {
    ...BASE_STATE,
    banner: {
      link: '',
      alt: 'Alert',
      text: 'Could not connect to server!'
    }
  }

  async load() {
    await this.replacePageData(await fetch('/'))
  }

  showBanner() {
    const data = this.state.banner
    const banner = $('.popup')! as HTMLAnchorElement

    banner.href = data.link;
    ($('img', banner) as HTMLImageElement).alt = data.alt;
    ($('span', banner) as HTMLSpanElement).textContent = data.text;

    banner.style = ''
  }

  setup() {
    this.showBanner()
  }

  destroy() {}

  async getInitialState() {
    try {
      const banner = JSON.parse(await (await fetch('/home-banner')).text()) as BannerData
      return {
        ...super.getInitialState(),
        banner
      }
    } catch (e) {}
    return this.state
  }

  updateState(banner: BannerData) {
    this.state.banner = banner
    this.replacePageState()
  }

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

  async getInitialState(): Promise<SearchPageState> {
    return {
      ...await super.getInitialState(),
      searchQuery: '',
      searchResults: ''
    }
  }

  updateState(query: string, searchResults: string) {
    this.state.searchQuery = query
    this.state.searchResults = searchResults

    this.replacePageState()
  }

  destroy() {}

  restore() {
    super.restore();

    ($('#textbar') as HTMLInputElement).value = this.state.searchQuery
    $('#search-results')!.innerHTML = this.state.searchResults
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

  protected state: NearbyPageState = {
    ...BASE_STATE,
    nearbyResults: ''
  }

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

    this.updateState(nearbyResults)
    this.showResults()
  }

  showResults() {
    $('#content')!.innerHTML = this.state.nearbyResults
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

  restore() {
    super.restore()
    this.showResults()
  }

  async getInitialState(): Promise<NearbyPageState> {
    return {
      ...await super.getInitialState(),
      nearbyResults: ''
    }
  }

  updateState(results: string) {
    this.state.nearbyResults = results
    this.replacePageState()
  }

}