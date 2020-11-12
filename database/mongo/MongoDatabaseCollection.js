module.exports = class MongoDatabaseCollection {
  constructor (mongoCollection) {
    this.collection = mongoCollection
  }

  createIndex (keys, options) {
    return this.collection.createIndex(keys, options)
  }

  createDocument (document) {
    return this.collection.insertOne(document)
  }

  createDocuments (documents) {
    return this.collection.insertMany(documents)
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

  replaceDocument (query, update, options) {
    return this.collection.replaceOne(query, update, options)
  }

  deleteDocument (query) {
    return this.collection.deleteOne(query)
  }

  deleteDocuments (query) {
    let bulk = this.collection.initializeUnorderedBulkOp()
    bulk.find(query).remove()
    return bulk.execute()
  }

  distinct (field, query) {
    return this.collection.distinct(field, query, { cursor: {} })
  }

  countDocuments (query) {
    return this.collection.countDocuments(query)
  }

  aggregate (pipeline) {
    return this.collection.aggregate(pipeline)
  }

  bulkWrite(operations) {
    return this.collection.bulkWrite(operations)
  }

  dropCollection() {
    return this.collection.drop()
  }

  async explain(query) {
    return (await query.explain('executionStats')).executionStats
  }
}
