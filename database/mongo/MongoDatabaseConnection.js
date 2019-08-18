const MongoDB = require('mongodb');
const {MongoClient} = MongoDB;

const DatabaseCollection = require('./MongoDatabaseCollection');

module.exports = class MongoDatabaseConnection {

    constructor(databaseURL, databaseName) {
        this.databaseURL = databaseURL;
        this.databaseName = databaseName
    }

    connect(options, callback) {
        if (callback == null) {
            callback = options;
        }

        MongoClient.connect(this.databaseURL, Object.assign(options, { useNewUrlParser: true }), (err, database) => {
            this.database = database.db(this.databaseName);

            callback(err);
        });
    }

    createCollection(collectionName, options) {
        this.database.createCollection(collectionName, options);
        return this.getCollection(collectionName);
    }

    getCollection(collectionName) {
        return new DatabaseCollection(this.database.collection(collectionName));
    }

}
