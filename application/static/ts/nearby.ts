import { App } from './app.js'
import { APP_RESTORE_KEY, BASE_STATE, Page, PageState } from './types.js'
import { $, search } from './util.js'

const RESTORE_CUTOFF = 1000 * 60 * 30 // 30 minutes

type NearbyPageState = PageState & {
  nearbyResults: string
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

  async restoreApp(app: App): Promise<boolean> {
    const savedData = localStorage.getItem(APP_RESTORE_KEY)
    if (!savedData) return false

    const lastPage = JSON.parse(savedData) as PageState
    const timeSinceLoaded = +new Date() - lastPage.pageLoaded
    if (timeSinceLoaded > RESTORE_CUTOFF) return false

    const targetURL = new URL(lastPage.url)
    if (targetURL.pathname === this.getURL().pathname) return false

    const factory = app.getFactory(targetURL)
    if (!factory) return false

    const restoredPage = factory.unserialise(targetURL, lastPage)
    console.log('Restoring', targetURL, restoredPage)
    await app.restorePage(restoredPage)

    return true
  }

  async setup(app: App): Promise<void> {
    if (search().query.app) {
      if (await this.restoreApp(app)) return
      this.url.search = ''
    }

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