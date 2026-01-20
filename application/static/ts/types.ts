import { $, deleteElem } from './util.js'

type PageContent = {
  header: HTMLElement,
  content: HTMLElement,
  styles: HTMLLinkElement[]
}

export abstract class Page {

  constructor(protected url: URL) {
  }

  abstract setup(): Promise<void> | void
  abstract destroy(): Promise<void> | void

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

  protected async replaceContent(req: Response): Promise<void> {
    const { content, header, styles } = await this.getPageContent(req)

    const existingHeader = $('#header')!
    existingHeader.innerHTML = header.innerHTML

    const existingContent = $('#content')!
    existingContent.innerHTML = content.innerHTML

    const existingStyles = [...document.querySelectorAll('link')]
      .filter(link => link.getAttribute('rel') === 'stylesheet')

    styles.forEach(link => document.head.appendChild(link))
    existingStyles.forEach(link => deleteElem(link))
  }
}

export abstract class PageFactory {

  abstract canCreatePage(url: URL): boolean
  abstract createPage(url: URL): Page

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
    await this.replaceContent(await fetch(this.path))
  }

  destroy() {}

}