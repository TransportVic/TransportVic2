DIRNAME=$(dirname "$0")

cd $DIRNAME/..

rm -rf public
mkdir public
mkdir public/static

node modules/optimise-svg.js
cp -R application/static/app-content public/static/
# cp -R application/static/css public/static/
cp -R application/static/fonts public/static/
cp -R application/static/images public/static/
cp -R application/static/seized public/static/

npm i uglify-js clean-css
node scripts/minify/scripts.mjs
node scripts/minify/styles.mjs