import { App } from './app.js'
import { APP_RESTORE_KEY, BASE_STATE, Mode, modeCSSNames, modeHumanNames, modeIconNames, Page, PageState } from './types.js'
import { $, inputTimeout, search } from './util.js'

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
    const target = (event.target as HTMLElement).closest('div.result')
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

    const html = this.stopsList.map(stop => `<div class="${modeCSSNames[stop.mode]} result">
      <div class="left-container">
        <img src="/static/images/clear-icons/${modeIconNames[stop.mode]}.svg">
      </div><div class="result-details">
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