#!/bin/bash

DIRNAME=$(dirname "$0")

rm -r "$DIRNAME/load-gtfs/spliced-gtfs-stuff"
mkdir "$DIRNAME/gtfs"
cd "$DIRNAME/gtfs" || exit

rm -r -- *
curl http://data.ptv.vic.gov.au/downloads/gtfs.zip --output gtfs.zip
unzip gtfs.zip

for i in {1..8}; do
  (
    cd $i || return 
    unzip google_transit.zip
  )
done

for i in {10..11}; do
  (
    cd $i || return
    unzip google_transit.zip
  )
done

mkdir 14
