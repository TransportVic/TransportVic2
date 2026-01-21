import { BASE_STATE, Page, PageFactory, PageState } from './types.js'
import { $, deleteElem } from './util.js'

type TimingPageState = PageState & {
  departureFilter: string,
  departureResults: string,
  lastUpdateTime: number
}

export class TimingPageFactory extends PageFactory {

  canCreatePage(url: URL): boolean {
    return !!url.pathname.match(new RegExp('/.+/timings/.+'))
  }

  createPage(url: URL): Page {
    return new TimingPage(url)
  }
}

export class TimingPage extends Page {

  private updateInterval: number = -1
  protected state: TimingPageState = {
    ...BASE_STATE,
    departureFilter: '',
    departureResults: '',
    lastUpdateTime: -1
  }

  getDepartureFilter() {
    const textbar = $('#textbar') as HTMLInputElement
    if (textbar) return textbar.value
    return ''
  }

  async updateBody() {
    const departureFilter = this.getDepartureFilter()
    const departureResults = await (await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
      })
    })).text()

    this.setDepartureResults(departureFilter, departureResults)
    this.updateState(departureFilter, departureResults, +new Date())
  }

  setDepartureResults(query: string, departureResults: string) {
    $('#departures')!.innerHTML = departureResults
    const departureDivs = [ ...document.querySelectorAll('#departures .departure') ] as HTMLElement[]

    for (const departureDiv of departureDivs) {
      const stopAtElem = departureDiv.querySelector('[name=stops-at]') as HTMLInputElement 
      const platformElem = departureDiv.querySelector('[name=platform]') as HTMLInputElement 
      const lineElem = departureDiv.querySelector('[name=line]') as HTMLInputElement 

      const stopsAt = stopAtElem.value.toLowerCase().split(',')
      const platform = platformElem.value.toLowerCase()
      const line = lineElem.value.toLowerCase()

      const platformNumber = (platform.match(/(\d+)/) || ['', ''])[1]
      const platformEnd = (platform.match(/\d+([A-Za-z])$/) || ['', ''])[1]

      const platformMatches = query === platformNumber ||
        (platformEnd ? platform.startsWith(query.toLowerCase()) : false)

      const departureMatches = 
        stopsAt.some(stop => stop.includes(query))
        || platformMatches
        || line.includes(query)

      if (!departureMatches) deleteElem(departureDiv)
    }
  }

  updateState(departureFilter: string, departureResults: string, lastUpdateTime?: number) {
    this.state.departureFilter = departureFilter
    this.state.departureResults = departureResults
    if (lastUpdateTime) this.state.lastUpdateTime = lastUpdateTime

    super.replacePageState()
  }

  private setupTextbar(textbar: HTMLInputElement): void {
    textbar.addEventListener('input', () => {
      const departureFilter = textbar.value
      const departureResults = this.state.departureResults

      this.setDepartureResults(departureFilter, departureResults)
      this.updateState(departureFilter, departureResults)
    })
  }

  async load(): Promise<any> {
    await this.replacePageData(await fetch(this.url))
    this.state.departureResults = $('#departures')!.innerHTML
  }

  getInitialState(): TimingPageState {
    const departureResults = $('#departures')!.innerHTML

    return {
      ...super.getInitialState(),
      content: $('main')!.innerHTML.replace(departureResults, ''),
      departureFilter: this.getDepartureFilter(),
      departureResults,
      lastUpdateTime: +new Date()
    }
  }

  setup(): void {
    this.updateInterval = setInterval(this.updateBody.bind(this), 3 * 1000)
    const textbar = $('#textbar') as HTMLInputElement | undefined

    if (textbar) this.setupTextbar(textbar)
  }

  destroy() {
    clearInterval(this.updateInterval)
  }

  restore() {
    super.restore()

    const textbar = $('#textbar') as HTMLInputElement | undefined
    if (this.state.departureFilter && textbar) textbar.value = this.state.departureFilter
    this.setDepartureResults(this.state.departureFilter, this.state.departureResults)

    // Update body if more than 15 seconds out of date
    if ((+new Date() - this.state.lastUpdateTime) > 1000 * 15) this.updateBody()
  }

}