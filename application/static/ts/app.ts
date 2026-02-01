import { BookmarksPage } from './bookmarks.js'
import { Error500Page } from './errors.js'
import { NearbyPage } from './nearby.js'
import { IndexPage, SearchPage } from './pages.js'
import { RunPageFactory } from './runs.js'
import { TimingPageFactory } from './timings.js'
import { TrackerPageFactory } from './tracker.js'
import { Page, PathPageFactory, StaticPageFactory } from './types.js'
import { pageReady } from './util.js'

export class App {

  private currentPage: Page | null = null

  private pageFactories = [
    new PathPageFactory('/', IndexPage),
    new StaticPageFactory('/links'),
    new PathPageFactory('/search', SearchPage),
    new PathPageFactory('/nearby', NearbyPage),
    new PathPageFactory('/bookmarks', BookmarksPage),
    new TimingPageFactory(),
    new RunPageFactory(),
    new TrackerPageFactory(),
    new StaticPageFactory('/mockups'),
    new StaticPageFactory('/500'),
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

    this.currentPage.setupDropdowns()
    await this.currentPage.initialiseState()
  }

  watchLinks(document: Document) {
    document.addEventListener('click', async event => {
      const target = (event.target as HTMLElement).closest('a')
      if (!target) return
      if (event.ctrlKey || event.metaKey) return

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
        await page.setup(this)

        window.history.pushState(page.serialise(), '', targetURL)
        this.setCurrentPage(page)
      } catch (e) {
        console.error('An error occurred setting up the page', e)

        const errorPage = new Error500Page(targetURL)
        await errorPage.load()

        window.history.pushState(errorPage.serialise(), '', errorPage.getURL())
        this.setCurrentPage(errorPage)
      }
    })
  }

  async restorePage(page: Page) {
    this.currentPage?.destroy()

    await page.restore()
    await page.setup(this)

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
    if (!this.currentPage) return
    await this.currentPage.setup(this)
    this.currentPage.replacePageState()
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