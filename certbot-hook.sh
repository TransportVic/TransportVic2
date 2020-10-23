#!/bin/bash

nc_token=""
nc_username=""

if [ "$1" == "auth" ]; then
  lexicon namecheap "$1" "${CERTBOT_DOMAIN}" TXT --name "_acme-challenge.${CERTBOT_DOMAIN}" --content "${CERTBOT_VALIDATION}" --auth-token="${nc_token}" --auth-username="${nc_username}" || exit 255
  sleep 30
else
  lexicon namecheap "$1" "${CERTBOT_DOMAIN}" TXT --name "_acme-challenge.${CERTBOT_DOMAIN}" --content "" --auth-token="${nc_token}" --auth-username="${nc_username}" || exit 255
fi
