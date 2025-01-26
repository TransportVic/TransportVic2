DIRNAME=$(dirname "$0")

cd $DIRNAME

rm -rf public
mkdir public
mkdir public/static

node modules/optimise-svg.js
cp -R application/static/ public/static/