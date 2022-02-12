#!/bin/bash

mongodump --collection="smartrak ids" --db="TransportVic" --gzip --archive="/home/ec2-user/backup/smartrak-ids.bson.gz"
mongodump --collection="bus trips" --db="TransportVic" --gzip --archive="/home/ec2-user/backup/bus-trips.bson.gz"
mongodump --collection="tram trips" --db="TransportVic" --gzip --archive="/home/ec2-user/backup/tram-trips.bson.gz"
mongodump --collection="metro trips" --db="TransportVic" --gzip --archive="/home/ec2-user/backup/metro-trips.bson.gz"
mongodump --collection="vline trips" --db="TransportVic" --gzip --archive="/home/ec2-user/backup/vline-trips.bson.gz"
