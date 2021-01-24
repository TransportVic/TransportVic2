#!/bin/bash

sudo mongodump --collection="smartrak ids" --db="TransportVic" --gzip --archive="/home/ec2-user/backup/smartrak-ids.bson.gz"
sudo mongodump --collection="bus trips" --db="TransportVic" --gzip --archive="/home/ec2-user/backup/bus-trips.bson.gz"
sudo mongodump --collection="tram trips" --db="TransportVic" --gzip --archive="/home/ec2-user/backup/tram-trips.bson.gz"
sudo mongodump --collection="metro trips" --db="TransportVic" --gzip --archive="/home/ec2-user/backup/metro-trips.bson.gz"
sudo mongodump --collection="vline trips" --db="TransportVic" --gzip --archive="/home/ec2-user/backup/vline-trips.bson.gz"
