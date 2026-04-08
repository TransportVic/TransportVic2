#! /bin/bash

sudo ln -sf /usr/share/zoneinfo/Australia/Melbourne /etc/localtime

cd $HOME
mkdir .ssh
chmod 700 .ssh
echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKJPl4NJwn4tTPTj6rtldXdB+je3/TFCJlz7+AKnf+T6 space grey macbook' > .ssh/authorized_keys
chmod 600 .ssh/authorized_keys

# Install node
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
source ~/.bashrc
nvm install node
sudo ln "$(readlink -f `command -v node`)" /usr/bin/node
sudo setcap 'cap_net_bind_service=+ep' /usr/bin/node

# Install cloudflared and warp
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflareclient.com/pubkey.gpg | sudo gpg --yes --dearmor --output /usr/share/keyrings/cloudflare-warp-archive-keyring.gpg
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null

echo "deb [signed-by=/usr/share/keyrings/cloudflare-warp-archive-keyring.gpg] https://pkg.cloudflareclient.com/ $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflare-client.list
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list

# Install MongoDB
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg \
  --dearmor

echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list

sudo apt-get update
sudo apt-get install -y cloudflare-warp cloudflared mongodb-org git xfsprogs vim
sudo apt-get remove -y mkvtoolnix eject \
  python3-rpi-lgpio gpiod \
  python3-lgpio rpicam-apps-lite \
  bluez-firmware libcamera-ipa
sudo apt-get autoremove -y
sudo systemctl disable bluetooth.service

warp-cli --accept-tos registration new transportvic
read -p 'Enter acceptance URL: ' WARP_TOKEN_URL
warp-cli --accept-tos registration token $WARP_TOKEN_URL
warp-cli registration show
warp-cli connect

sleep 5
read -p 'Enter hostname: ' HOSTNAME
sudo raspi-config nonint do_hostname "$HOSTNAME"

IP_ADDR=$(ifconfig | grep -A1 CloudflareWARP | grep -o "100.96.[0-9]*.[0-9]*" | head -n 1)
printf '''# mongod.conf

# for documentation of all options, see:
#   http://docs.mongodb.org/manual/reference/configuration-options/

storage:
  dbPath: /TransportVic/MongoDB-Trip/data

systemLog:
  destination: file
  logAppend: true
  path: /TransportVic/MongoDB-Trip/logs/mongod.log

# network interfaces
net:
  port: 27017
  bindIp: 127.0.0.1,%s,%s

processManagement:
  timeZoneInfo: /usr/share/zoneinfo

replication:
  replSetName: "transportvic"
''' $IP_ADDR $(hostname) | sudo tee /etc/mongod-trip.conf

printf '''# mongod.conf

# for documentation of all options, see:
#   http://docs.mongodb.org/manual/reference/configuration-options/

storage:
  dbPath: /TransportVic/MongoDB/data

systemLog:
  destination: file
  logAppend: true
  path: /TransportVic/MongoDB/logs/mongod.log

# network interfaces
net:
  port: 27018
  bindIp: 127.0.0.1,%s

processManagement:
  timeZoneInfo: /usr/share/zoneinfo
''' $(hostname) | sudo tee /etc/mongod.conf

sudo chmod a+r /etc/mongod.conf
sudo chmod g+rw /etc/mongod.conf
sudo chown mongodb /etc/mongod.conf
sudo chgrp transportvic /etc/mongod.conf

sudo chmod a+r /etc/mongod-trip.conf
sudo chmod g+rw /etc/mongod-trip.conf
sudo chown mongodb /etc/mongod-trip.conf
sudo chgrp transportvic /etc/mongod-trip.conf

printf '''[Unit]
Description=MongoDB Trip Database Server
Documentation=https://docs.mongodb.org/manual

[Service]
Restart=always
RestartSec=2
User=mongodb
Group=mongodb
EnvironmentFile=-/etc/default/mongod
Environment="MONGODB_CONFIG_OVERRIDE_NOFORK=1"
Environment="GLIBC_TUNABLES=glibc.pthread.rseq=0"
ExecStartPre=/TransportVic/MongoDB-Trip/network-config.sh
ExecStart=/usr/bin/mongod --config /etc/mongod-trip.conf
RuntimeDirectory=mongodb
# file size
LimitFSIZE=infinity
# cpu time
LimitCPU=infinity
# virtual memory size
LimitAS=infinity
# open files
LimitNOFILE=64000
# processes/threads
LimitNPROC=64000
# locked memory
LimitMEMLOCK=infinity
# total threads (user+kernel)
TasksMax=infinity
TasksAccounting=false
Restart=always

# Recommended limits for mongod as specified in
# https://docs.mongodb.com/manual/reference/ulimit/#recommended-ulimit-settings

[Install]
WantedBy=multi-user.target''' | sudo tee /usr/lib/systemd/system/mongod-trip.service

printf '''[Unit]
Description=MongoDB Database Server
Documentation=https://docs.mongodb.org/manual
After=network-online.target
Wants=network-online.target

[Service]
Restart=always
RestartSec=2
User=mongodb
Group=mongodb
EnvironmentFile=-/etc/default/mongod
Environment="MONGODB_CONFIG_OVERRIDE_NOFORK=1"
Environment="GLIBC_TUNABLES=glibc.pthread.rseq=0"
ExecStart=/usr/bin/mongod --config /etc/mongod.conf
RuntimeDirectory=mongodb
# file size
LimitFSIZE=infinity
# cpu time
LimitCPU=infinity
# virtual memory size
LimitAS=infinity
# open files
LimitNOFILE=64000
# processes/threads
LimitNPROC=64000
# locked memory
LimitMEMLOCK=infinity
# total threads (user+kernel)
TasksMax=infinity
TasksAccounting=false

# Recommended limits for mongod as specified in
# https://docs.mongodb.com/manual/reference/ulimit/#recommended-ulimit-settings

[Install]
WantedBy=multi-user.target''' | sudo tee /usr/lib/systemd/system/mongod.service

printf '''[Unit]
Description=Allow Cloudflare WARP to start and establish the CGNAT IP
After=warp-svc.service
Wants=warp-svc.service

[Timer]
OnBootSec=25sec

[Install]
WantedBy=timers.target''' | sudo tee /usr/lib/systemd/system/mongod-trip.timer

printf '''[Unit]
Description=Cloudflare Zero Trust Client Daemon
After=pre-network.target

[Service]
Type=simple
ExecStart=/bin/warp-svc
ExecStartPost=/TransportVic/MongoDB-Trip/warp-start.sh
DynamicUser=no
CapabilityBoundingSet=CAP_NET_ADMIN CAP_NET_BIND_SERVICE CAP_SYS_PTRACE CAP_DAC_READ_SEARCH CAP_NET_RAW CAP_SETUID CAP_SETGID
AmbientCapabilities=CAP_NET_ADMIN CAP_NET_BIND_SERVICE CAP_SYS_PTRACE CAP_DAC_READ_SEARCH CAP_NET_RAW CAP_SETUID CAP_SETGID
StateDirectory=cloudflare-warp
RuntimeDirectory=cloudflare-warp
LogsDirectory=cloudflare-warp
Restart=always

[Install]
WantedBy=multi-user.target''' | sudo tee /usr/lib/systemd/system/warp-svc.service

printf '''[Unit]
Description=Allow Cloudflare WARP to start and establish the CGNAT IP
After=warp-svc.service
Wants=warp-svc.service

[Timer]
OnBootSec=25sec

[Install]
WantedBy=timers.target''' | sudo tee /usr/lib/systemd/system/mongod-trip.timer

sudo systemctl enable mongod.service
sudo systemctl disable mongod-trip.service
sudo systemctl enable mongod-trip.timer

sudo raspi-config nonint do_composite 0

sudo chgrp transportvic /etc/hosts
sudo chmod g+rw /etc/hosts

sudo mkdir /TransportVic
mkdir $HOME/TransportVic

sudo mkfs.xfs /dev/nvme0n1
sudo mount /dev/nvme0n1 /TransportVic
sudo mount /dev/nvme0n1 /home/transportvic/TransportVic

sudo chown -R transportvic /TransportVic
sudo chgrp -R transportvic /TransportVic
sudo chown -R transportvic /home/transportvic/TransportVic
sudo chgrp -R transportvic /home/transportvic/TransportVic

mkdir /TransportVic/Holesail
mkdir /TransportVic/MongoDB
mkdir /TransportVic/MongoDB/logs
mkdir /TransportVic/MongoDB/data

mkdir /TransportVic/MongoDB-Trip
mkdir /TransportVic/MongoDB-Trip/logs
mkdir /TransportVic/MongoDB-Trip/data

chmod a+r /TransportVic

printf '''Host backups-deploy
  HostName github.com
  User git
  IdentityFile ~/.ssh/backups-deploy.github.com''' > .ssh/config

chmod 600 .ssh/config
ssh-keygen -t ed25519 -C "server backup key" -f .ssh/backups-deploy.github.com -N ""
echo "Backup Deploy Public Key:"
echo "Press Enter after adding key to GitHub:"
echo `cat .ssh/backups-deploy.github.com.pub`
read

git clone backups-deploy:eyeballcode/transportvic-backups /TransportVic/Backups
git clone --recurse-submodules https://github.com/TransportVic/TransportVic2.git /TransportVic/Server

cd /TransportVic/Server
git config submodule.recurse true
npm i -d
echo "modules.json" > modules.json
vi modules.json
echo "urls.json" > urls.json
vi urls.json
echo "config.json" > config.json
vi config.json
echo "NODE_ENV=prod" > .env

printf '''[Unit]
Description=TransportVic Server
Requires=cloudflared.service

[Service]
User=transportvic
ExecStart=/TransportVic/Server/start
Restart=always

[Install]
WantedBy=multi-user.target''' | sudo tee /etc/systemd/system/transportvic.service

printf '''#! /bin/bash
IP_ADDR=$(ifconfig | grep -A1 CloudflareWARP | grep -o "100.96.[0-9]*.[0-9]*" | head -n 1)
HOSTNAME=$(hostname)
cp /etc/mongod-trip.conf /tmp/mongod-trip.conf
if [[ -z "$IP_ADDR" ]]; then
  sed -i -E '\''s/bindIp.+/bindIp: 127.0.0.1/'\'' /tmp/mongod-trip.conf
  echo "Did not find CF IP Address, skipping"
else
  sed -i -E '\''s/bindIp.+/bindIp: 127.0.0.1,'\''"$IP_ADDR"'\'','\''"$HOSTNAME"'\''/'\'' /tmp/mongod-trip.conf
  echo "Found CF IP Address, binding"
fi
cat /tmp/mongod-trip.conf > /etc/mongod-trip.conf
rm /tmp/mongod-trip.conf''' > /TransportVic/MongoDB-Trip/network-config.sh
chmod a+x /TransportVic/MongoDB-Trip/network-config.sh

printf '''#! /bin/bash
sleep 3

IP_ADDR=$(ifconfig | grep -A1 CloudflareWARP | grep -o "100.96.[0-9]*.[0-9]*" | head -n 1)
HOSTNAME=$(hostname)
MONGOD_CONFIG=$(cat /etc/mongod-trip.conf | grep "$HOSTNAME")

if [[ -z "$MONGOD_CONFIG" && ! -z "$IP_ADDR" ]]; then
  echo "Found CF IP Address with no entry in mongod config, restarting"
  sudo systemctl restart mongod-trip
fi
''' > /TransportVic/MongoDB-Trip/warp-start.sh
chmod a+x /TransportVic/MongoDB-Trip/warp-start.sh

sudo chown mongodb -R /TransportVic/MongoDB
sudo chmod g+rw /TransportVic/MongoDB

sudo chown mongodb -R /TransportVic/MongoDB-Trip
sudo chmod g+rw /TransportVic/MongoDB-Trip

# rs.initiate({
#    _id : "transportvic",
#    members: [
#       { _id: 0, host: "s1.transportvic.me" }
#    ]
# })

sudo systemctl enable transportvic

cloudflared login

cd $HOME

read -p 'Enter tunnel secret: ' TUNNEL_SECRET
echo $TUNNEL_SECRET > ~/.cloudflared/transportvic.json
echo '''url: http://localhost:8000
tunnel: 19c9f518-bacd-4a52-adfb-113ca32302cb
credentials-file: /home/transportvic/.cloudflared/transportvic.json''' > .cloudflared/config.yaml

echo '''[Unit]
Description=Cloudflare Tunnel
After=transportvic.service
BindsTo=transportvic.service

[Service]
User=transportvic
TimeoutStartSec=0
Type=notify
ExecStart=cloudflared tunnel run transportvic
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target''' | sudo tee /etc/systemd/system/cloudflared.service

FSTAB_NVME=$(grep nvme /etc/fstab)
if [[ -z "$FSTAB_NVME" ]]; then
  echo """/dev/nvme0n1          /TransportVic   xfs     defaults          0       1
/dev/nvme0n1          /home/transportvic/TransportVic   xfs     defaults          0       1""" | sudo tee --append /etc/fstab
fi