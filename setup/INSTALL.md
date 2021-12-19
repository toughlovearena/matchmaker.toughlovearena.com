# matchmaking server setup

how to setup ec2 instance

## installing on ubuntu

### setup os

```bash

# set password to tlap
sudo su -
passwd ubuntu
exit

# update
sudo apt-get -y update

```

### setup nginx

```bash
# setup nginx to serve hello page
sudo apt install nginx

# (optional firewall stuff) confirm Nginx Full is listed, then allow it
sudo ufw app list
sudo ufw allow 'Nginx Full'
sudo ufw status

# dump in nginx.conf
sudo vi /etc/nginx/sites-enabled/default

# restart nginx
systemctl restart nginx

```

### setup certbot

```bash

# install snap, then certbot
sudo snap install core; sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
sudo certbot --nginx

# to renew
sudo certbot renew --dry-run

```

### setup nvm

```bash

curl https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash
nvm install $(cat .nvmrc)

```

### setup repo

```bash

git clone https://github.com/toughlovearena/matchmaker.toughlovearena.com.git
cd matchmaker.toughlovearena.com
npm i
npm bg

```
