DIRNAME=$(dirname "$0")

cd $DIRNAME/additional-data
curl https://www.vic.gov.au/sites/default/files/2020-09/Victorian-public-holiday-dates.ics --output vic-holidays.ics
