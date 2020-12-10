#!/bin/bash

echo "LANG=en_US.utf-8
LC_ALL=en_US.utf-8" | sudo tee /etc/environment

sudo ln -sf /usr/share/zoneinfo/Australia/Melbourne /etc/localtime

sudo yum remove httpd -y
sudo yum remove postfix -y

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
sudo ln "$(readlink -f `command -v node`)" /usr/bin/node

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
sudo yum install certbot-apache -y
sudo yum install python2-dns-lexicon -y
