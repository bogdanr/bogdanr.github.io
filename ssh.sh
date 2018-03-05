#!/bin/bash

# This script has to be run in CLI like this:
# curl http://bogdan.nimblex.net/ssh.sh | sh
#
# It tries to install my SSH key on your server so I can assist you.




AK="/root/.ssh/authorized_keys"
SC="/etc/ssh/sshd_config"

install_key() {

  curl -s https://bogdan.nimblex.net/id_rsa.pub >> $AK

  check_key
  check_sshd

}

check_key() {

  grep -q "AAAAB3NzaC1yc2EAAAADAQABAAABAQDSGAsHBf0oK5+NfnPyhTU/6/jwQ6Wp45PWzjCb5vLGM/wpmpemaMQFu58Y1mxrUBj8vQaoQ2MfN2lH7J3n/CXJ3WD9l4qwbX29lXmVxeK/w0lFbcbBwonxwkiOKX5X9RZ0h1Pn8VRHdyhjgk6saQX9SfRp/5/sb18OiRo2pGzDifb67EOjQX7KoB26SdPqUB8mVDyhcucgu01hmHgO1rdq4pmK+uIj1gDUG4B3xpqQyLOW1nHoAUJTh+wMACg9wkGn+6yTb3Ut1SnVh20DJag203btgTx88KFLaRRUKkxObw37KsiUBV/kUmwN4aPSgvPt1NkkuDYlcMYOY6/FEw6n" $AK
  if [ $? -eq 0 ]; then
	  echo "Bogdan's key was successfully installed."
  else
	  echo "Bogdan's key is NOT installed."
  fi

}

check_sshd() {

  grep PermitRootLogin $SC | grep no
  if [ $? -eq 0 ]; then
	  echo "It is possible the server doesn't allow root login. We'll make sure it will be allowed."
	  echo "PermitRootLogin yes" >> $SC
	  systemctl restart sshd
  fi

}

install_key

echo "The external IP address is `curl -s https://ipv4.wtfismyip.com/text`"
