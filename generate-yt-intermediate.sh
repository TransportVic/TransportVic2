function timeout() { perl -e 'alarm shift; exec @ARGV' "$@"; }

timeout 5 openssl s_client -connect ws2.tramtracker.com.au:443 -servername ws2.tramtracker.com.au > logcertfile
CERT_URL=$(openssl x509 -in logcertfile -noout -text | grep -i "ca issuer" | grep -E -o 'http.+')
rm logcertfile
curl --output tt-intermediate.crt $CERT_URL
openssl x509 -inform DER -in tt-intermediate.crt -out tt-intermediate.pem -text
rm tt-intermediate.crt
