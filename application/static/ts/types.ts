import { $, deleteElem } from './util.js'

type PageContent = {
  header: HTMLElement,
  content: HTMLElement,
  styles: HTMLLinkElement[]
}

type SerialisedPage = {
  header: string,
  content: string,
  styles: string[]
}

export abstract class Page {

  private state: SerialisedPage = {
    header: '',
    content: '',
    styles: []
  }

  constructor(protected url: URL) {
  }

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

    this.replaceHeaderContent(header.innerHTML)
    this.replaceMainContent(content.innerHTML)
    this.replaceStyles(styles)

    this.state = {
      header: header.innerHTML,
      content: content.innerHTML,
      styles: styles.map(link => link.getAttribute('href') || '').filter(Boolean)
    }
  }

  restore() {
    this.replaceHeaderContent(this.state.header)
    this.replaceMainContent(this.state.content)
    this.replaceStylesFromLinks(this.state.styles)
  }

  serialise(): SerialisedPage { return this.state }

  setState(state: SerialisedPage) { this.state = state }
}

export abstract class PageFactory {

  abstract canCreatePage(url: URL): boolean
  abstract createPage(url: URL): Page

  unserialise(url: URL, state: SerialisedPage): Page {
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

  async setup(): Promise<any> {
    await this.replacePageData(await fetch(this.path))
  }

  destroy() {}

}