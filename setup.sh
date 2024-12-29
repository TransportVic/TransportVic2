#!/bin/bash

echo "LANG=en_US.utf-8
LC_ALL=en_US.utf-8" | sudo tee /etc/environment

sudo ln -sf /usr/share/zoneinfo/Australia/Melbourne /etc/localtime

sudo dnf remove httpd -y
sudo dnf remove postfix -y

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
source ~/.bashrc
nvm install node

echo "[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/9/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://pgp.mongodb.com/server-7.0.asc" | sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo
sudo dnf install -y mongodb-mongosh-shared-openssl3 git
sudo dnf install -y mongodb-org

sudo dnf install -y python3 augeas-libs python-pip
sudo python3 -m venv /opt/certbot/
sudo /opt/certbot/bin/pip install --upgrade pip
sudo /opt/certbot/bin/pip install certbot certbot-nginx
sudo ln -s /opt/certbot/bin/certbot /usr/bin/certbot

sudo python3 -m venv /opt/lexicon/
sudo /opt/lexicon/bin/pip install --upgrade pip
sudo /opt/lexicon/bin/pip install dns-lexicon[namecheap]
sudo ln -s /opt/lexicon/bin/lexicon /usr/bin/lexicon

sudo chmod a+rw -R /var/log/mongodb
sudo setcap 'cap_net_bind_service=+ep' "$(readlink -f `command -v node`)"

sudo groupadd certbot
sudo usermod -a -G certbot ec2-user
sudo usermod -a -G certbot root

sudo mkdir /etc/letsencrypt /var/log/letsencrypt /var/lib/letsencrypt

sudo chgrp certbot /etc/letsencrypt -R
sudo chgrp certbot /var/log/letsencrypt -R
sudo chgrp certbot /var/lib/letsencrypt -R

sudo chmod g=rwx,o= -R /etc/letsencrypt
sudo chmod g=rwx,o= -R /var/log/letsencrypt
sudo chmod g=rwx,o= -R /var/lib/letsencrypt

sudo chmod a+r -R /etc/letsencrypt
sudo chmod a+r -R /var/log/letsencrypt
sudo chmod a+r -R /var/lib/letsencrypt

sudo yum install xfsprogs
sudo sfdisk /dev/sdf <<EOF
,
write
EOF
sudo mkfs.xfs -f /dev/sdf1
sudo mount -t xfs /dev/sdf1 /data/mongo
sudo chown mongod /data/mongo



# If needed to configure SELinux
sudo semanage fcontext -a -t mongod_var_lib_t '/home/mongod.*'
sudo chcon -Rv -u system_u -t mongod_var_lib_t '/home/mongod'

sudo semanage fcontext -a -t mongod_log_t '/home/mongod.*'
sudo chcon -Rv -u system_u -t mongod_log_t '/home/mongod'

sudo semanage fcontext -a -t mongod_var_run_t '/home/mongod.*'
sudo chcon -Rv -u system_u -t mongod_var_run_t '/home/mongod'
sudo restorecon -R -v '/home/mongod'