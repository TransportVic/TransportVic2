import { BASE_STATE, Page, PageState } from './types.js'
import { $, inputTimeout } from './util.js'

type SearchPageState = PageState & {
  searchQuery: string
  searchResults: string
}

type IndexPageState = PageState & {
  banner: BannerData
}

type BannerData = {
  link: string,
  alt: string,
  text: string
}

export class IndexPage extends Page {

  protected state: IndexPageState = {
    ...BASE_STATE,
    banner: {
      link: '',
      alt: 'Alert',
      text: 'Could not connect to server!'
    }
  }

  async load() {
    await this.replacePageData(await fetch('/'))
  }

  showBanner() {
    const banner = $('.popup') as HTMLAnchorElement
    if (!banner) return

    const data = this.state.banner
    banner.href = data.link;
    ($('img', banner) as HTMLImageElement).alt = data.alt;
    ($('span', banner) as HTMLSpanElement).textContent = data.text;

    banner.style = ''
  }

  setup() {
    this.showBanner()
  }

  destroy() {}

  async getInitialState(): Promise<IndexPageState> {
    try {
      const banner = JSON.parse(await (await fetch('/home-banner')).text()) as BannerData
      return {
        ...await super.getInitialState(),
        banner
      }
    } catch (e) {}

    return {
      ...await super.getInitialState(),
      banner: this.state.banner
    }
  }

  updateState(banner: BannerData) {
    this.state.banner = banner
    this.replacePageState()
  }

}

export class SearchPage extends Page {

  private searchID: number = 0
  protected state: SearchPageState = {
    ...BASE_STATE,
    searchQuery: '',
    searchResults: ''
  }

  async load(): Promise<any> {
    await this.replacePageData(await fetch('/search'))
  }

  setup(): void {
    inputTimeout($('#textbar') as HTMLInputElement, this.performSearch.bind(this))
  }

  async performSearch() {
    const currentSearchID = ++this.searchID
    const query = ($('#textbar') as HTMLInputElement).value

    $('#loading')!.style = 'display: block;'
    const searchResults = await (await fetch('/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    })).text()

    // Out of date
    if (currentSearchID !== this.searchID) return

    $('#loading')!.style = 'display: none;'
    this.setSearchResults(searchResults)
    this.updateState(query, searchResults)
  }

  setSearchResults(searchResults: string) {
    $('#search-results')!.innerHTML = searchResults
  }

  async getInitialState(): Promise<SearchPageState> {
    return {
      ...await super.getInitialState(),
      searchQuery: '',
      searchResults: ''
    }
  }

  updateState(query: string, searchResults: string) {
    this.state.searchQuery = query
    this.state.searchResults = searchResults

    this.replacePageState()
  }

  destroy() {}

  restore() {
    super.restore();

    ($('#textbar') as HTMLInputElement).value = this.state.searchQuery
    $('#search-results')!.innerHTML = this.state.searchResults
  }

}
