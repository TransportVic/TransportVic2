import { App } from './app.js'
import { BASE_STATE, Mode, modeCSSNames, modeHumanNames, modeIconNames, Page, PageState } from './types.js'
import { $, inputTimeout } from './util.js'

type JourneyPageState = PageState & {
  origin: {
    query: string
    stop: StopData | null
  },
  destination: {
    query: string,
    stop: StopData | null
  }
}

type StopType = 'origin' | 'destination'

type RawStopData = {
  id: string,
  modes: string[],
  name: string,
  suburb: string
}

type StopData = {
  id: string,
  mode: Mode,
  name: string,
  suburb: string
}

const shortModes: Record<string, Mode> = {
  bus: 'bus',
  tram: 'tram',
  'regional coach': 'coach',
  'regional train': 'vline',
  'metro train': 'metro',
  ferry: 'ferry',
  unknown: 'unknown'
}

const longModes: Record<Mode, string> = {
  'bus': 'bus',
  'tram': 'tram',
  'coach': 'regional coach',
  'vline': 'regional train',
  'metro': 'metro train',
  'ferry': 'ferry',
  'unknown': 'unknown'
}

export default class JourneyPage extends Page {

  protected state: JourneyPageState = {
    ...BASE_STATE,
    origin: {
      query: '',
      stop: null
    },
    destination: {
      query: '',
      stop: null
    }
  }

  private stopsList: StopData[] = []

  async load(): Promise<void> {
    await this.replacePageData(await fetch(this.getURL()))
  }

  setup(app: App): void {
    this.setupJourneyInputs('origin', 'destination')
    this.setupJourneyInputs('destination', 'origin')
    this.setDepartureTime()
    this.setupEventListeners()
  }

  setupJourneyInputs(type: StopType, clear: StopType) {
    const parent = $(`.journey-${type}`)! as HTMLDivElement
    inputTimeout($('input', parent) as HTMLInputElement, this.fetchSuggestedStops.bind(this,
      type, parent, $(`.journey-${clear}`)! as HTMLDivElement
    ))

    $('.stop-suggestions', parent)!.addEventListener('click', this.handleStopClick.bind(this,
      type, parent
    ))
  }

  setupEventListeners() {
    $('#plan-journey')?.addEventListener('click', event => {
      event.preventDefault()
      this.planJourney()
    })
  }

  async planJourney() {
    if (!this.state.origin.stop || !this.state.destination.stop) return

    const data = JSON.parse(await (await fetch('/journey/plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        arriveBy: ($('#journey-time-type') as HTMLInputElement).value === 'Arrival',
        originStop: {
          id: this.state.origin.stop.id,
          mode: longModes[this.state.origin.stop.mode]
        },
        destinationStop: {
          id: this.state.destination.stop.id,
          mode: longModes[this.state.destination.stop.mode]
        },
        dateTime: ($('#departure-time') as HTMLInputElement).valueAsDate
      })
    })).text())

    const innerHTML = data.journeys.map((journey: { html: string }) => journey.html).join('')
    $('#journey-results')!.innerHTML = innerHTML

    console.log(data)
  }

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

  setDepartureTime() {
    const time = new Date();
    ($('#departure-time') as HTMLInputElement).value = `${this.formatDate(time)}T${this.formatTime(time)}`;
  }

  async fetchSuggestedStops(type: StopType, parent: HTMLDivElement, otherParent: HTMLDivElement, query: string) {
    otherParent.classList.remove('show-suggestions')
    parent.classList.add('show-suggestions')

    this.state[type].query = query
    const response = await fetch('/journey/stops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    })
    if (response.status !== 200) return
    const stops = JSON.parse(await response.text()) as RawStopData[]

    this.showSuggestedStops($('.stop-suggestions', parent) as HTMLDivElement, stops)
  }

  handleStopClick(type: StopType, parent: HTMLDivElement, event: PointerEvent) {
    const suggestionsList = $('.stop-suggestions', parent)! as HTMLElement
    const inputBox = $('input', parent)! as HTMLInputElement
    const target = (event.target as HTMLElement).closest('div.stop-result')
    if (!target) return

    const stopIndex = Array.from(suggestionsList.children).indexOf(target)
    const selectedStop = this.stopsList[stopIndex]
    this.state[type].stop = selectedStop

    inputBox.value = selectedStop.name
    parent.classList.remove('show-suggestions')
  }

  showSuggestedStops(suggestionsList: HTMLDivElement, stops: RawStopData[]) {
    this.stopsList = stops.flatMap(stop => stop.modes.map(mode => ({
      id: stop.id, mode: shortModes[mode], name: stop.name, suburb: stop.suburb
    })))

    const html = this.stopsList.map(stop => `<div class="${modeCSSNames[stop.mode]} stop-result">
      <div class="left-container">
        <img src="/static/images/clear-icons/${modeIconNames[stop.mode]}.svg">
      </div><div class="stop-result-details">
        <span>${modeHumanNames[stop.mode]} in ${stop.suburb}</span>
        <span>${stop.name}</span>
      </div>
    </div>`).join('')

    suggestionsList.innerHTML = html
  }

  destroy(): void {
  }

  async getInitialState(): Promise<JourneyPageState> {
    return {
      ...await super.getInitialState(),
      origin: {
        query: '',
        stop: null
      },
      destination: {
        query: '',
        stop: null
      }
    }
  }

}