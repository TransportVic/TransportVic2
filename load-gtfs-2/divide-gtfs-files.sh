for i in {1..8}; do
  node --max-old-space-size=2048 utils/divide-and-conquer.js $i
done

for i in {10..11}; do
  node --max-old-space-size=2048 utils/divide-and-conquer.js $i
done
