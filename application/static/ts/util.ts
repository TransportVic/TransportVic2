export function on(elem: HTMLElement | Window | Document, event: string, callback: EventListenerOrEventListenerObject) {
  elem.addEventListener(event, callback)
}

export function toggleClass(elem: HTMLElement, rawClassName: string) {
  const className = rawClassName.trim()
  const classes = elem.className
  const matchingRegex = new RegExp(`\\b${className}\\b`)

  if (classes.match(matchingRegex)) {
    elem.className = elem.className.replace(matchingRegex, ' ').trim()
  } else {
    elem.className += ` ${className}`
  }
}

export function $(query: string, elem?: HTMLElement): HTMLElement | null {
  if (elem) return elem.querySelector(query)
  return document.querySelector(query)
}

export function deleteQuery(query: string) {
  const target = $(query)
  if (target && target.parentElement) target.parentElement.removeChild(target)
}

export function deleteElem(target: HTMLElement) {
  if (target && target.parentElement) target.parentElement.removeChild(target)
}

export function pageReady(callback: (this: Document, ev?: Event) => any) {
  if (document.readyState !== 'loading') {
    setTimeout(callback, 0)
  } else {
    document.addEventListener('DOMContentLoaded', callback)
  }
}

export function pageLoaded(callback: (this: Window, ev?: Event) => any) {
  if (document.readyState !== 'complete') {
    setTimeout(callback, 0)
  } else {
    window.addEventListener('load', callback)
  }
}

const processKVPairs = (data: string) => data
  .slice(1)
  .split('&')
  .filter(Boolean)
  .map(e => e.split('='))
  .reduce((acc: Record<string, string>, e) => ({ ...acc, [e[0]]: decodeURIComponent((e[1] || 'true').replace(/\+/g, ' ')) }), {})

export const search = {
  hash: processKVPairs(location.hash),
  query: processKVPairs(location.search),
}

export function inputTimeout(elem: HTMLInputElement, callback: CallableFunction) {
  let timeoutID = -1

  on(elem, 'input', () => {
    clearTimeout(timeoutID)
    timeoutID = setTimeout(callback, 650, elem.value)
  })
}

export function isPWA() {
  return window.matchMedia('(display-mode: standalone)').matches
}