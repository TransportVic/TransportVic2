#!/bin/bash

echo "LANG=en_US.utf-8
LC_ALL=en_US.utf-8" | sudo tee /etc/environment

sudo ln -sf /usr/share/zoneinfo/Australia/Melbourne /etc/localtime

sudo yum remove httpd -y
sudo yum remove postfix -y

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
source ~/.bashrc
nvm install node

echo "[mongodb-org-4.2]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/amazon/2/mongodb-org/4.2/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-4.2.asc" | sudo tee /etc/yum.repos.d/mongodb-org-4.2.repo
sudo yum install -y mongodb-org git

sudo amazon-linux-extras install epel -y
sudo yum install certbot-apache python-pip -y
sudo pip install dns-lexicon[namecheap]

sudo chmod a+rw -R /var/log/mongodb
sudo ln "$(readlink -f `command -v node`)" /usr/bin/node
sudo setcap 'cap_net_bind_service=+ep' /usr/bin/node

sudo groupadd certbot
sudo usermod -a -G certbot ec2-user
sudo usermod -a -G certbot root

sudo chgrp certbot /etc/letsencrypt -R
sudo chgrp certbot /var/log/letsencrypt -R
sudo chgrp certbot /var/lib/letsencrypt -R

sudo chmod g=rwx,o= -R /etc/letsencrypt
sudo chmod g=rwx,o= -R /var/log/letsencrypt
sudo chmod g=rwx,o= -R /var/lib/letsencrypt

sudo chmod a+r -R /etc/letsencrypt
sudo chmod a+r -R /var/log/letsencrypt
sudo chmod a+r -R /var/lib/letsencrypt
