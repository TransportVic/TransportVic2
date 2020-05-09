curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
echo "
. ~/.nvm/nvm.sh
alias sudo='sudo env PATH=$PATH:$NVM_BIN'" >> ~/.bashrc

source ~/.bashrc
nvm install node

echo "[mongodb-org-4.2]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/amazon/2013.03/mongodb-org/4.2/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-4.2.asc" | sudo tee /etc/yum.repos.d/mongodb-org-4.2.repo
sudo yum install -y mongodb-org git

sudo amazon-linux-extras install epel -y
sudo yum install certbot-apache -y
sudo yum install python34 python34-pip -y

sudo yum install gdal-libs gdal libgdal-dev -y

export CPLUS_INCLUDE_PATH=/usr/include/gdal
export C_INCLUDE_PATH=/usr/include/gdal
