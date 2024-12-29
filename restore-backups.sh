mongorestore --db="TransportVic" --gzip --archive="metro-trips.bson.gz"
mongorestore --db="TransportVic" --gzip --archive="tram-trips.bson.gz"

mongodump --collection="tram trips" --db="TransportVic" --gzip --archive="tram-trips.bson.gz" --query='{ "date": "" }'
mongodump --collection="metro trips" --db="TransportVic" --gzip --archive="metro-trips.bson.gz" --query='{ "date": "" }'
