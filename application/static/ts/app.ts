import { BookmarksPage } from './bookmarks.js'
import { IndexPage, NearbyPage, SearchPage } from './pages.js'
import { RunPageFactory } from './runs.js'
import { TimingPageFactory } from './timings.js'
import { APP_RESTORE_KEY, Page, PathPageFactory, StaticPageFactory } from './types.js'
import { on, pageReady } from './util.js'

class App {

  private currentPage: Page | null = null

  private pageFactories = [
    new PathPageFactory('/', IndexPage),
    new StaticPageFactory('/links'),
    new PathPageFactory('/search', SearchPage),
    new PathPageFactory('/nearby', NearbyPage),
    new PathPageFactory('/bookmarks', BookmarksPage),
    new TimingPageFactory(),
    new RunPageFactory(),
  ] as const

  constructor(landingPage: URL) {
    const pageFactory = this.getFactory(landingPage)
    if (!pageFactory) return

    this.currentPage = pageFactory.createPage(landingPage)
  }

  getFactory(url: URL) {
    return this.pageFactories.find(fac => fac.canCreatePage(url))
  }

  async initialise() {
    if (!this.currentPage) return

    await this.currentPage.initialiseState()
    this.currentPage.replacePageState()
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

      window.history.pushState(page.serialise(), '', targetURL)
      this.setCurrentPage(page)
    })
  }

  async restorePage(page: Page) {
    this.currentPage?.destroy()

    await page.restore()
    await page.setup()

    this.setCurrentPage(page)
  }

  watchPopState(window: Window) {
    // Note: browser handles change of URL for us
    window.addEventListener('popstate', async event => {
      const targetURL = new URL((event.target as Window).location.toString())
      const serialisedPage = event.state

      const pageFactory = this.getFactory(targetURL)
      if (!pageFactory) return window.location = targetURL.toString()

      const restoredPage = pageFactory.unserialise(targetURL, serialisedPage)
      console.log('Transitioning to', targetURL, restoredPage)
      await this.restorePage(restoredPage)
    })
  }

  async setup() {
    if (this.currentPage) await this.currentPage.setup()
  }

  setCurrentPage(page: Page) {
    this.currentPage = page
    page.markPageAsActive()
  }
}

pageReady(async () => {
  const app = new App(new URL(location.toString()))
  await app.initialise()
  app.watchLinks(document)
  app.watchPopState(window)
  await app.setup()

  window.app = app
})

declare global {
  interface Window { app: App }
}