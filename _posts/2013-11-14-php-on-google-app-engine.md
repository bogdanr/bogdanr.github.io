---
layout: post
title: "PHP on Google App Engine"
description: "Google App Engine for PHP but not for everybody"
category: "Cloud"
tags: [Cloud, Google, PHP, App Engine]
---
{% include JB/setup %}

![PHP App Engine]({{ site.url }}/assets/img/google-appengine-php.gif){.right}

You can host your PHP apps on the Google infrastructure and only pay according to how popular your app is.

This sounds super nice, specially since it can even be free of charge for personal websites or provide automatic scalability for sites which plan to attract a lot of traffic.

## How straightforward is that?

Well, not very. To maintain very high level of scalability your code doesn't use a LAMP stack like you're used to, but instead it uses a container which has some advantages and some limitations.

### The main limitations:

+ Other computers can only connect to the application by making HTTP (or HTTPS) requests on the standard ports. The app container doesn't even have a normal networking stack so it will communicate externally by doing [URL Fetch](https://developers.google.com/appengine/docs/php/urlfetch/)
+ Applications cannot write to the file system. The app must use the App Engine datastore, memcache or other services for all data that persists between requests.
+ Application code only runs in response to a web request, a queued task, or a scheduled task, and must return response data within 60 seconds in any case. A request handler cannot spawn a sub-process or execute code after the response has been sent.
+ No way of using PHP modules which are not supported by Google App Engine.

### The main advantages:

+ It's very efficient as it utilizes the minimum amount of resources necessary to run your code, thus it can be very cost effective.
+ Having a minimal read-only environment where you don't even have a shell makes things very secure both for your app and for Google.
+ Integration with other very nice services such as CloudSQL, PageSpeed and others.
+ Introduction of new "concepts" such as Task Queues which makes things more efficient.

### Running off the shelf apps:

If you are interested in running something complex app like Joomla, Wordpress or many others, App engine is probably not the way to go, even though PHP is [almost standard](http://php-minishell.appspot.com/phpinfo) and they could run.

Specifically, these two are made such that you customize them with modules and templates from the admin panel by uploading and decompressing files on the file system, which is not possible here. Fortunately there is a workaround for that because you can do it in your local development environment and then redeploy the application. Actually, there is even a [tutorial](https://developers.google.com/appengine/articles/wordpress) made especially for WordPress.

Also, all these have Media Managers for uploading photos and other files you offer for download on your site. For these you could have modifications done in the code or plugins which allow [uploading files](https://developers.google.com/appengine/docs/php/googlestorage/#writing_to_google_cloud_storage) to Google Cloud Storage.

### Running new apps:

If you plan to write a new app, indeed Google App Engine will almost constrain you from the beginning to make it scalable. With some of the limitations they provide you also get benefits, but certainly there are things to consider beyond that.

For example, if your application will get more complex, then you'll want to start using [Task Queues](https://developers.google.com/appengine/docs/php/taskqueue/), not only because it's a great concept but because you won't have a choice. I bet Google uses this a lot with their apps to give the impression of everything happening instantly. Unfortunately, the downside is that using this creates vendor lockin and then you'll be stuck with having to use App Engine forever.

### Other considerations:

For MySQL, Google also has a separate service called Cloud SQL which is pretty nice. You connect to it using a socket connection and of course there are some decent limits in place. The Cloud SQL service should be fine for small to medium traffic levels where it's not necessary to tune MySQL or to store lots of data.

While running your local [development environment](https://developers.google.com/appengine/docs/php/tools/devserver) is the way to go in most situations, having to do that for simple tasks such as installing a theme to platforms such as Wordpress or Joomla is definitely not very convenient. I will have to do it on the computer where I have everything setup and it would be out of the reach for non-technical people.

The Google Apps admin interface is not done yet. It switches back and forth between the old and new depending on the service you access and some of the things are not integrated well and clear. While running my test Wordpress app I qualify for free of charge usage on App Engine but I need to enable billing for using Cloud SQL and Cloud Storage. These also seem to be cost effective for low usage but I can't really figure out how much I'd have to pay if I have an app that gets 100 requests per day.

## Conclusion:

App Engine for PHP seems awesome if you develop specifically for it and if you are fine with going on purpose into vendor lock-in. For other situations also consider the alternatives (shared hosting, virtual machines, etc.).
