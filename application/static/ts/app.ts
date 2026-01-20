import { Page, StaticPageFactory } from './types.js'
import { on, pageReady } from './util.js'

class App {

  private currentPage: Page | null = null

  private pageFactories = [
    new StaticPageFactory('/'),
    new StaticPageFactory('/links')
  ] as const

  constructor(landingPage: URL) {
    const pageFactory = this.getFactory(landingPage)
    if (!pageFactory) return

    this.currentPage = pageFactory.createPage(landingPage)
  }

  getFactory(url: URL) {
    return this.pageFactories.find(fac => fac.canCreatePage(url))
  }

  watchLinks(document: Document) {
    document.addEventListener('click', async event => {
      const target = (event.target as HTMLElement).closest('a')
      if (!target) return
      const targetURL = new URL(target.href)
      const pageFactory = this.getFactory(targetURL)
      if (!pageFactory) return

      event.preventDefault()
      window.history.pushState(this.currentPage?.serialise(), '', targetURL)

      const page = pageFactory.createPage(targetURL)

      this.currentPage?.destroy()
      await page.setup()

      this.currentPage = page
    })
  }

  watchPopState(window: Window) {
    window.addEventListener('popstate', async event => {
      const targetURL = new URL((event.target as Window).location.toString())
      const serialisedPage = event.state

      const pageFactory = this.getFactory(targetURL)
      if (!pageFactory) return window.location = targetURL.toString()

      const restoredPage = pageFactory.unserialise(targetURL, serialisedPage)

      console.log('Transitioning to', targetURL)

      this.currentPage?.destroy()
      this.currentPage = restoredPage
      await restoredPage.setup()
    })
  }

}

pageReady(() => {
  const app = new App(new URL(location.toString()))
  app.watchLinks(document)
  app.watchPopState(window)
})