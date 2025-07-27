if [ ! -f config.json ]; then
  echo '{}' > config.json
fi

if [ ! -f modules.json ]; then
  echo '{}' > modules.json
fi

npm run test-report