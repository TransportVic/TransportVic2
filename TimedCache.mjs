export default class TimedCache {

  constructor(ttl) {
    this.ttl = ttl
    this.cache = {}
    setInterval(() => {
      Object.keys(this.cache).forEach(key => {
        this.get(key)
      })
    }, 1000 * 60)
  }

  get(key) {
    let holder = this.cache[key]
    if (holder) {
      if (new Date() - holder.created > this.ttl) {
        delete this.cache[key]
        return null
      } return this.cache[key].obj
    } else return null
  }

  put(key, value) {
    this.cache[key] = {
      created: new Date(),
      obj: value
    }
  }

  getTTL() {
    return this.ttl
  }

  setTTL(ttl) {
    this.ttl = ttl
  }

}
