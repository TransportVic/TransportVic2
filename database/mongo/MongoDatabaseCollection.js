module.exports = class MongoDatabaseCollection {
  constructor (mongoCollection) {
    this.collection = mongoCollection
  }

  createIndex (keys, options) {
    this.collection.createIndex(keys, options)
  }

  createDocument (document) {
    return this.collection.insertOne(document)
  }

  findDocuments (query, projection) {
    return this.collection.find(query, projection)
  }

  findDocument (query, projection, callback) {
    return this.collection.findOne(query, projection, callback)
  }

  updateDocuments (query, update) {
    return this.collection.updateMany(query, update)
  }

  updateDocument (query, update) {
    return this.collection.updateOne(query, update)
  }

  deleteDocument () {

  }

  distinct (field) {
    return this.collection.distinct(field, { cursor: {} })
  }

  countDocuments (query) {
    return this.collection.countDocuments(query)
  }

  aggregate (pipeline) {
    return this.collection.aggregate(pipeline)
  }
}
