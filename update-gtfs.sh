cd gtfs
rm -r *
curl http://data.ptv.vic.gov.au/downloads/gtfs.zip --output gtfs.zip
unzip gtfs.zip
for i in {1..8}; do
  cd $i
  unzip google_transit.zip
  cp google_transit.zip ../../../OpenTripPlanner/google_transit_${i}.zip
  cd ..
done

for i in {10..11}; do
  cd $i
  unzip google_transit.zip
  cp google_transit.zip ../../../OpenTripPlanner/google_transit_${i}.zip
  cd ..
done
rm gtfs.zip
