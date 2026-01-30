import { $, deleteElem } from './util.js'

export const APP_RESTORE_KEY = 'transportvic.pwa-last-page'
export const BOOKMARK_KEY = 'transportvic.bookmarks'

type PageContent = {
  header: HTMLElement,
  content: HTMLElement,
  styles: HTMLLinkElement[]
}

export type PageState = {
  header: string,
  content: string,
  styles: string[],
  pageLoaded: number
}

export const BASE_STATE: PageState = {
  header: '',
  content: '',
  styles: [],
  pageLoaded: 0
} as const

export abstract class Page {

  protected state: PageState = {
    ...BASE_STATE
  }

  constructor(protected url: URL) {
  }

  abstract load(): Promise<void> | void
  abstract setup(): Promise<void> | void
  abstract destroy(): Promise<void> | void

  getURL() { return this.url }

  protected async getPageContent(req: Response): Promise<PageContent> {
    const htmlResponse = await req.text()
    const dummyElem = document.createElement('html')
    dummyElem.innerHTML = htmlResponse

    const contentElem = dummyElem.getElementsByTagName('main')[0] as HTMLElement
    const headerElem = dummyElem.getElementsByTagName('nav')[0] as HTMLElement
    const styles = [...dummyElem.getElementsByTagName('link')]
      .filter(link => link.getAttribute('rel') === 'stylesheet')

    return {
      content: contentElem || document.createElement('main'),
      header: headerElem || document.createElement('nav'),
      styles
    }
  }

  private getExistingStyles(): HTMLLinkElement[] {
    return [...document.querySelectorAll('link')]
      .filter(link => link.getAttribute('rel') === 'stylesheet')
  }

  protected replaceHeaderContent(newHeaderHTML: string) {
    const existingHeader = $('#header')!
    existingHeader.innerHTML = newHeaderHTML
  }

  protected replaceMainContent(newContentHTML: string) {
    const existingContent = $('#content')!
    existingContent.innerHTML = newContentHTML
  }

  protected replaceStyles(newStyles: HTMLLinkElement[]) {
    const existingStyles = this.getExistingStyles()

    newStyles.forEach(link => document.head.appendChild(link))
    existingStyles.forEach(link => deleteElem(link))
  }

  protected replaceStylesFromLinks(newStyles: string[]) {
    const existingStyles = this.getExistingStyles()

    newStyles.forEach(href => {
      const link = document.createElement('link')
      link.setAttribute('rel', 'stylesheet')
      link.setAttribute('href', href)
      document.head.appendChild(link)
    })

    existingStyles.forEach(link => deleteElem(link))
  }

  protected async replacePageData(req: Response): Promise<void> {
    const { content, header, styles } = await this.getPageContent(req)

    this.replaceStyles(styles)
    this.replaceHeaderContent(header.innerHTML)
    this.replaceMainContent(content.innerHTML)

    await this.initialiseState()
  }

  getInitialState(): Promise<PageState> | PageState {
    return {
      header: $('nav')?.innerHTML || '',
      content: $('main')?.innerHTML || '',
      styles: this.getExistingStyles().map(link => link.getAttribute('href') || '').filter(Boolean),
      pageLoaded: +new Date()
    }
  }

  async initialiseState() {
    this.state = await this.getInitialState()
  }

  restore() {
    this.replaceStylesFromLinks(this.state.styles)
    this.replaceHeaderContent(this.state.header)
    this.replaceMainContent(this.state.content)

    this.state.pageLoaded = +new Date()
  }

  serialise(): PageState { return this.state }

  setState(state: PageState) { this.state = state }

  replacePageState() {
    window.history.replaceState(this.serialise(), '')
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

class StaticPage extends Page {

  constructor (url: URL, private path: string) {
    super(url)
  }

  async load(): Promise<any> {
    await this.replacePageData(await fetch(this.path))
  }

  setup() {}
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