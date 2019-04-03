---
layout: post
title: "How to give access on AWS to a consultant"
description: "Bringing together multiple AWS accounts in one"
category: "Cloud"
tags: [Cloud, AWS]
---

I am a DevOps consultant so I have access to a bunch of AWS accounts, in addition to my own. If I was to use individual credentials for each account, it would be very inconvenient especially since I have to switch between accounts multiple times a day. For a while now, AWS has a nice feature which allows me to access multiple accounts from my own AWS account. This feature is called **Roles**.

The official documentation for this is [easily available](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_switch-role-console.html) but maybe not so easy to understand by everybody.

This guide is intended to be the most straightforward way of giving access to a person who uses more than one AWS account.

![IAM Roles switching]({{ site.url }}/assets/img/IAMRoles.png)

### Setting up a role for access from another account

1. Go to **IAM** -> **Roles** and click [Create role](https://console.aws.amazon.com/iam/home#/roles$new). Ask for the account ID.
![IAM Roles New1]({{ site.url }}/assets/img/IAMRolesNew1.png)
2. Go through each step one by one and select the appropriate permissions.
![IAM Roles New2]({{ site.url }}/assets/img/IAMRolesNew2.png)
![IAM Roles New3]({{ site.url }}/assets/img/IAMRolesNew3.png)
3. Cases matter. I use Bogdan every time so it's easy to remember.
![IAM Roles New4]({{ site.url }}/assets/img/IAMRolesNew4.png)
4. Click **Create role** and if you're only in charge of giving access your job is done.

### Using this new role in your main account

1. Click your account name from the top right corner and find the Switch Role button.
![AWS Switch Role]({{ site.url }}/assets/img/IAMRolesSwitch1.png)
2. Fill in all the info.
![AWS Switch Role data]({{ site.url }}/assets/img/IAMRolesSwitch2.png)
3. Enjoy this faster way of switching AWS accounts.

There is a limitation though to a maximum of 5 accounts but if you just learned about this I am sure you can live with this limitation :)

### Conclusion

This is a nice time-saving feature which facilitates using multiple AWS accounts. AWS was somewhat late in the game with this feature. Others from my toolbox that support something similar are CloudFlare, GoDaddy and obviously Google.
