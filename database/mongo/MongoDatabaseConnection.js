const MongoDB = require('mongodb')
const { MongoClient } = MongoDB

const DatabaseCollection = require('./MongoDatabaseCollection')

module.exports = class MongoDatabaseConnection {
  constructor (databaseURL, databaseName) {
    this.databaseURL = databaseURL
    this.databaseName = databaseName
  }

  connect (options, callback) {
    if (callback == null) {
      callback = options
    }

    return new Promise(resolve => {
      MongoClient.connect(this.databaseURL, Object.assign(options, { useNewUrlParser: true, useUnifiedTopology: true }), (err, client) => {
        this.database = client.db(this.databaseName)

        resolve()
        if (typeof callback == 'function')
          callback(err)
      })
    })
  }

  createCollection (collectionName, options) {
    this.database.createCollection(collectionName, options)
    return this.getCollection(collectionName)
  }

  getCollection (collectionName) {
    return new DatabaseCollection(this.database.collection(collectionName))
  }
}
