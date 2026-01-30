import { Bookmarks, Mode } from './bookmarks.js'
import { BASE_STATE, Page, PageFactory, PageState } from './types.js'
import { $, deleteElem } from './util.js'

type TimingPageState = PageState & {
  departureFilter: string,
  departureResults: string,
  lastUpdateTime: number,
  departureTime: number | null
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
    lastUpdateTime: -1,
    departureTime: null
  }

  private timePicker: TimePicker | undefined

  private isBookmarked: boolean = false
  private stopName: string = ''
  private suburb: string = ''
  private stopID: string = ''
  private mode: Mode = 'unknown'

  getDepartureFilter() {
    const textbar = $('#textbar') as HTMLInputElement
    if (textbar) return textbar.value
    return ''
  }

  async updateBody() {
    const departureFilter = this.getDepartureFilter()
    const departureTime = this.state.departureTime

    const departureResults = await (await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(departureTime ? {
        departureTime: new Date(departureTime).toISOString()
      }: {})
    })).text()

    this.setDepartureResults(departureFilter, departureResults)
    this.updateState(departureFilter, departureResults, +new Date())
  }

  setDepartureResults(query: string, departureResults: string) {
    $('#departures')!.innerHTML = departureResults
    if (!query) return

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

  setupClock() {
    const hasCombinedPicker = navigator.userAgent.includes('Chrome') || (navigator.userAgent.includes('Mobile') && navigator.userAgent.includes('Safari'))
    const clock = $('#clock') as HTMLImageElement
    const dateTimePicker = $('#departureDateTime') as HTMLInputElement

    if (!clock || !dateTimePicker) return

    const timePicker = hasCombinedPicker ? new CombinedPicker(clock, dateTimePicker) : new HTMLPicker(
      clock, dateTimePicker,
      $('#clockDropdown') as HTMLDivElement,
      $('#departureDate') as HTMLInputElement,
      $('#departureTime') as HTMLInputElement,
      $('#confirmTime') as HTMLInputElement,
    )

    const initialTime = this.state.departureTime ? new Date(this.state.departureTime) : new Date()
    timePicker.setup(initialTime, this.setDepartureTime.bind(this))
    this.timePicker = timePicker
  }

  setupBookmark() {
    this.isBookmarked = Bookmarks.isStopBookmarked(this.stopID, this.mode)
    this.updateBookmark()
    $('#bookmark')!.addEventListener('click', this.bookmarkClicked.bind(this))
  }

  bookmarkClicked() {
    this.isBookmarked = !this.isBookmarked

    if (this.isBookmarked) Bookmarks.addStopBookmark(this.stopID, this.stopName, this.suburb, this.mode)
    else Bookmarks.removeStopBookmark(this.stopID, this.mode)

    this.updateBookmark()
  }

  updateBookmark() {
    const icon = $('#bookmark') as HTMLImageElement
    if (this.isBookmarked) icon.src = '/static/images/decals/bookmark-filled.svg'
    else icon.src = '/static/images/decals/bookmark.svg'
  }

  setDepartureTime(time: Date) {
    this.state.departureTime = +time
    this.replacePageState()
    this.updateBody()
  }

  async load(): Promise<any> {
    await this.replacePageData(await fetch(this.url))
  }

  async getInitialState(): Promise<TimingPageState> {
    const departureResults = $('#departures')!.innerHTML

    return {
      ...await super.getInitialState(),
      content: $('main')!.innerHTML.replace(departureResults, ''),
      departureFilter: this.getDepartureFilter(),
      departureResults,
      lastUpdateTime: +new Date(),
      departureTime: null
    }
  }

  setup(): void {
    this.updateInterval = setInterval(this.updateBody.bind(this), 30 * 1000)
    const textbar = $('#textbar') as HTMLInputElement | undefined

    this.stopName = ($('meta[name="stop-name"]') as HTMLMetaElement).content
    this.suburb = ($('meta[name="stop-suburb"]') as HTMLMetaElement).content
    this.stopID = ($('meta[name="stop-id"]') as HTMLMetaElement).content
    this.mode = this.url.pathname.split('/')[1] as Mode

    if (textbar) this.setupTextbar(textbar)
    this.setupClock()
    this.setupBookmark()
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

abstract class TimePicker {
  abstract setup(time: Date, callback: (date: Date) => void): void

  protected formatDate(time: Date) {
    return [
      time.getFullYear(),
      (time.getMonth() + 1).toString().padStart(2, '0'),
      (time.getDate()).toString().padStart(2, '0')
    ].join('-')
  }

  protected formatTime(time: Date) {
    return [
      time.getHours().toString().padStart(2, '0'),
      time.getMinutes().toString().padStart(2, '0')
    ].join(':')
  }
}

class CombinedPicker extends TimePicker {

  constructor(private clock: HTMLImageElement, private dateTimePicker: HTMLInputElement) {
    super()
  }

  initialisePickers(time: Date) {
    this.dateTimePicker.value = `${this.formatDate(time)}T${this.formatTime(time)}`
  }

  setup(time: Date, callback: (date: Date) => void) {
    this.initialisePickers(time)

    this.clock.addEventListener('click', () => this.dateTimePicker.showPicker())
    this.clock.addEventListener('keypress', e => {
      if (e.key === 'Enter') this.dateTimePicker.showPicker()
    })

    this.dateTimePicker.addEventListener('change', () => {
      callback(new Date(this.dateTimePicker.value))
    })
  }
}

class HTMLPicker extends TimePicker {

  private dropdownOpen: boolean = false
  private openTime: Date = new Date(0)

  constructor(
    private clock: HTMLImageElement,
    private dateTimePicker: HTMLInputElement,
    private dropdown: HTMLDivElement,
    private datePicker: HTMLInputElement,
    private timePicker: HTMLInputElement,
    private confirmButton: HTMLInputElement
  ) {
    super()
  }

  initialisePickers(time: Date) {
    this.datePicker.value = this.formatDate(time)
    this.timePicker.value = this.formatTime(time)
  }

  setup(time: Date, callback: (date: Date) => void) {
    this.dateTimePicker.style.display = 'none'

    this.initialisePickers(time)

    this.clock.addEventListener('click', this.openClock.bind(this))
    this.clock.addEventListener('keypress', event => {
      if (event.key === 'Enter') this.openClock()
    })

    document.body.addEventListener('click', this.bodyClick.bind(this))
    document.body.addEventListener('keydown', this.escapePressed.bind(this))
    this.confirmButton.addEventListener('click', this.updateTime.bind(this, callback))
  }

  openClock() {
    if (this.dropdownOpen) return
    this.dropdown.classList.add('showing')
    this.dropdownOpen = true
    this.openTime = new Date()
  }

  closeClock() {
    // Prevent immediately opening and closing in same click event
    if (+new Date() - +this.openTime < 50) return

    this.dropdown.classList.remove('showing')
    this.dropdownOpen = false
  }

  bodyClick(event: PointerEvent) {
    if (!this.dropdownOpen) return

    let elem = event.target as HTMLElement

    for (let i = 0; i < 3; i++) {
      if (!elem) break
      else if (elem === this.dropdown) return
      elem = elem.parentElement!
    }

    this.closeClock()
  }

  escapePressed(event: KeyboardEvent) {
    if (!this.dropdownOpen) return

    if (event.key === 'Escape') this.closeClock()
  }

  updateTime(callback: (date: Date) => void) {
    if (!this.dropdownOpen) return
    this.closeClock()

    const departureDateParts = this.datePicker.value.match(/^(\d+)-(\d+)-(\d+)$/)
    const departureTimeParts = this.timePicker.value.match(/^(\d+):(\d+)$/)

    if (!departureDateParts || !departureTimeParts) return

    const [ year, month, day ] = departureDateParts.slice(1).map(v => parseInt(v))
    const [ hours, minutes ] = departureTimeParts.slice(1).map(v => parseInt(v))

    callback(new Date(year, month - 1, day, hours, minutes))
  }
}
