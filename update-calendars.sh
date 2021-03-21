#!/bin/bash
DIRNAME=$(dirname "$0")

cd "$DIRNAME/additional-data" || return
curl https://www.vic.gov.au/sites/default/files/2020-09/Victorian-public-holiday-dates.ics --output vic-holidays.ics
curl https://www.vic.gov.au/sites/default/files/2021-03/Daylight-saving.ics --output daylight-saving.ics
