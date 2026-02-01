import { App } from './app.js'
import { $, deleteElem } from './util.js'

export const APP_RESTORE_KEY = 'transportvic.pwa-last-page'
export const BOOKMARK_KEY = 'transportvic.bookmarks'

export type Mode = 'bus' | 'metro' | 'tram' | 'coach' | 'vline' | 'ferry' | 'unknown'

export const modeCSSNames: Record<Mode, string> = {
  bus: 'busStop',
  tram: 'tramStop',
  coach: 'regionalCoachStop',
  vline: 'vlineStation',
  metro: 'metroStation',
  ferry: 'ferryTerminal',
  unknown: 'unknown'
}

export const modeIconNames: Record<Mode, string> = {
  bus: 'bus',
  tram: 'tram',
  coach: 'bus',
  vline: 'vline',
  metro: 'metro',
  ferry: 'ferry',
  unknown: 'unknown'
}

export const modeHumanNames: Record<Mode, string> = {
  bus: 'Bus Stop',
  tram: 'Tram Stop',
  coach: 'Regional Coach Stop',
  vline: 'V/Line Train Station',
  metro: 'Metro Train Station',
  ferry: 'Ferry Terminal',
  unknown: 'unknown'
}

type PageContent = {
  header: HTMLElement,
  content: HTMLElement,
  headerTags: HTMLElement[]
}

export type PageState = {
  header: string,
  content: string,
  docHeader: string,
  pageLoaded: number,
  url: string
}

export const BASE_STATE: PageState = {
  header: '',
  content: '',
  docHeader: '',
  pageLoaded: 0,
  url: 'https://transportvic.me'
} as const

export abstract class Page {

  protected state: PageState = {
    ...BASE_STATE
  }

  constructor(protected url: URL) {
  }

  abstract load(): Promise<void> | void
  abstract setup(app: App): Promise<void> | void
  abstract destroy(): Promise<void> | void

  scroll() {
    window.scrollTo(0, 0)
  }

  getURL() { return this.url }

  protected async getPageContent(req: Response): Promise<PageContent> {
    const htmlResponse = await req.text()
    if (500 <= req.status && req.status < 600) throw new Error('500')

    const dummyElem = document.createElement('html')
    dummyElem.innerHTML = htmlResponse

    const contentElem = dummyElem.getElementsByTagName('main')[0] as HTMLElement
    const headerElem = dummyElem.getElementsByTagName('nav')[0] as HTMLElement
    const headerTags = [...dummyElem.querySelectorAll('title, link, head meta')] as HTMLElement[]

    return {
      content: contentElem || document.createElement('main'),
      header: headerElem || document.createElement('nav'),
      headerTags
    }
  }

  protected replaceHeaderContent(newHeaderHTML: string) {
    const existingHeader = $('#header')!
    existingHeader.innerHTML = newHeaderHTML
  }

  protected replaceMainContent(newContentHTML: string) {
    const existingContent = $('#content') as HTMLDivElement
    existingContent.innerHTML = newContentHTML

    this.setupDropdowns()
  }

  protected replaceDocumentHeader(newTags: HTMLElement[]) {
    this.replaceDocumentHeaderContent(newTags.map(elem => elem.outerHTML).join(''))
  }

  protected replaceDocumentHeaderContent(content: string) {
    document.head.innerHTML = content
  }

  protected async replacePageData(req: Response): Promise<void> {
    const { content, header, headerTags } = await this.getPageContent(req)

    this.replaceDocumentHeader(headerTags)
    this.replaceHeaderContent(header.innerHTML)
    this.replaceMainContent(content.innerHTML)

    await this.initialiseState()
  }

  setupDropdowns() {
    const dropdowns = Array.from(document.querySelectorAll('#content .customDropdown')) as HTMLDivElement[]
    for (const dropdown of dropdowns) {
      const span = $('span', dropdown) as HTMLSpanElement
      const select = $('select', dropdown) as HTMLSelectElement

      select.addEventListener('change', () => {
        span.textContent = select.options[select.selectedIndex].value
      })
    }

  }

  getInitialState(): Promise<PageState> | PageState {
    return {
      header: $('nav')?.innerHTML || '',
      content: $('main')?.innerHTML || '',
      docHeader: $('head')?.innerHTML || '',
      pageLoaded: +new Date(),
      url: this.getURL().toString()
    }
  }

  async initialiseState() {
    this.state = await this.getInitialState()
  }

  restore() {
    this.replaceDocumentHeaderContent(this.state.docHeader)
    this.replaceHeaderContent(this.state.header)
    this.replaceMainContent(this.state.content)

    this.state.pageLoaded = +new Date()
  }

  serialise(): PageState { return this.state }

  setState(state: PageState) { this.state = state }

  replacePageState() {
    window.history.replaceState(this.serialise(), '', this.getURL())
    this.markPageAsActive()
  }
  
  markPageAsActive() {
    window.localStorage.setItem(APP_RESTORE_KEY, JSON.stringify(this.serialise()))
  }
}

export abstract class PageFactory {

  abstract canCreatePage(url: URL): boolean
  abstract createPage(url: URL): Page

  unserialise(url: URL, state: PageState): Page {
    const page = this.createPage(url)
    page.setState(state)
    return page
  }

}

export class StaticPageFactory extends PageFactory {

  constructor(private path: string) {
    super()
  }

  canCreatePage(url: URL): boolean {
    return url.pathname === this.path
  }

  createPage(url: URL): Page {
    return new StaticPage(url, this.path)
  }

}

export class StaticPage extends Page {

  constructor(url: URL, private path: string) {
    super(url)
  }

  async load(): Promise<any> {
    await this.replacePageData(await fetch(this.path))
  }

  setup(app: App) {}
  destroy() {}

}

export class PathPageFactory extends PageFactory {

  constructor(private path: string, private pageConstructor: new (url: URL) => Page) {
    super()
  }

  canCreatePage(url: URL): boolean {
    return url.pathname === this.path
  }

  createPage(url: URL): Page {
    return new this.pageConstructor(url)
  }
}