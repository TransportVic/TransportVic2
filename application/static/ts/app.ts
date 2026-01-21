import { NearbyPage, SearchPage } from './pages.js'
import { TimingPageFactory } from './timings.js'
import { Page, PathPageFactory, StaticPageFactory } from './types.js'
import { on, pageReady } from './util.js'

class App {

  private currentPage: Page | null = null

  private pageFactories = [
    new StaticPageFactory('/'),
    new StaticPageFactory('/links'),
    new PathPageFactory('/search', SearchPage),
    new PathPageFactory('/nearby', NearbyPage),
    new TimingPageFactory(),
  ] as const

  constructor(landingPage: URL) {
    const pageFactory = this.getFactory(landingPage)
    if (!pageFactory) return

    this.currentPage = pageFactory.createPage(landingPage)
    this.currentPage.initialiseState()
    window.history.replaceState(this.currentPage.serialise(), '')
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

      const page = pageFactory.createPage(targetURL)

      try {
        await this.currentPage?.destroy()
      } catch (e) {
        console.error('An error occurred tearing down the page', e)
      }

      try {
        await page.load()
        await page.setup()
      } catch (e) {
        console.error('An error occurred setting up the page', e)
      }

      this.currentPage = page

      window.history.pushState(page.serialise(), '', targetURL)
    })
  }

  watchPopState(window: Window) {
    window.addEventListener('popstate', async event => {
      const targetURL = new URL((event.target as Window).location.toString())
      const serialisedPage = event.state

      const pageFactory = this.getFactory(targetURL)
      if (!pageFactory) return window.location = targetURL.toString()

      const restoredPage = pageFactory.unserialise(targetURL, serialisedPage)

      console.log('Transitioning to', targetURL, restoredPage)

      this.currentPage?.destroy()
      this.currentPage = restoredPage

      await restoredPage.restore()
      await restoredPage.setup()
    })
  }

  async setup() {
    if (this.currentPage) await this.currentPage.setup()
  }

}

pageReady(async () => {
  const app = new App(new URL(location.toString()))
  app.watchLinks(document)
  app.watchPopState(window)
  await app.setup()

  window.app = app
})

declare global {
  interface Window { app: App }
}