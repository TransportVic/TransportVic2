#!/bin/bash
DIRNAME=$(dirname "$0")

mongodump --collection="smartrak ids" --db="TransportVic" --gzip --archive="$DIRNAME/backup/smartrak-ids.bson.gz"
mongodump --collection="bus trips" --db="TransportVic" --gzip --archive="$DIRNAME/backup/bus-trips.bson.gz"
mongodump --collection="tram trips" --db="TransportVic" --gzip --archive="$DIRNAME/backup/tram-trips.bson.gz"
mongodump --collection="metro trips" --db="TransportVic" --gzip --archive="$DIRNAME/backup/metro-trips.bson.gz"
mongodump --collection="vline trips" --db="TransportVic" --gzip --archive="$DIRNAME/backup/vline-trips.bson.gz"
