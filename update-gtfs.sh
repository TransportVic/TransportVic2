DIRNAME=$(dirname "$0")

cd $DIRNAME/gtfs
rm -r *
curl http://data.ptv.vic.gov.au/downloads/gtfs.zip --output gtfs.zip
unzip gtfs.zip
