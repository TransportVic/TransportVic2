if [ ! -f config.json ]; then
  echo '{}' > config.json
fi

npm run test-report