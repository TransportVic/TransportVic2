DIRNAME=$(dirname "$0")

cd $DIRNAME/gtfs
rm -r *
curl http://data.ptv.vic.gov.au/downloads/gtfs.zip --output gtfs.zip
unzip gtfs.zip

for i in {1..8}; do
  cd $i
  unzip google_transit.zip
  cd ..
done

for i in {10..11}; do
  cd $i
  unzip google_transit.zip
  cd ..
done
