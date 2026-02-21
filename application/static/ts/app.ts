import { BookmarksPage } from './bookmarks.js'
import { Error500Page } from './errors.js'
import JourneyPage from './jp.js'
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
    new StaticPageFactory('/about'),
    new StaticPageFactory('/500'),
    new PathPageFactory('/journey', JourneyPage),
  ] as const

  constructor(landingPage: URL) {
    const pageFactory = this.getFactory(landingPage)
    if (!pageFactory) return

    this.currentPage = pageFactory.createPage(landingPage)
  }

  getCurrentPage() { return this.currentPage }

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

        // Equivalent to DOMContentLoaded
        window.history.pushState(page.serialise(), '', targetURL)
        this.setCurrentPage(page)

        // Equivalent to window.onload
        await page.setup(this)

        page.scroll()
      } catch (e) {
        console.error('An error occurred setting up the page', e)

        // Fallback to traditional page load
        window.location.href = targetURL.toString()
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

  async loadServiceWorker() {
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      console.log('Service Worker registered!')
      await navigator.serviceWorker.ready
      console.log('Service Worker ready!')
    }
  }
}

pageReady(async () => {
  const app = new App(new URL(location.toString()))
  window.app = app

  await app.initialise()
  app.watchLinks(document)
  app.watchPopState(window)
  await app.setup()

  await app.loadServiceWorker()
})

declare global {
  interface Window { app: App }
}