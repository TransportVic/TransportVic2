DIRNAME=$(dirname "$0")

sudo systemctl stop server
node $DIRNAME/timetable-updating-server/index.js
sudo systemctl start server
