---
layout: page
title: Hello World!
tagline: Blog around GNU/Linux & friends
---
{% include JB/setup %}

This page will try to be a resource for technical people interested in all things that run on GNU/Linux.

Additionally, here we'll also try to follow the developmet of [NimbleX](http://nimblex.net), to keep a connection with the community.

## Resources

+ [NimbleX and Slackware packages](http://packages.nimblex.net)
+ [My Semantic & Responsive Resume](/cv)
+ [SlackBuilds](http://github.com/bogdanr/slackbuilds)

## Posts

Here's a sample "posts list".

<ul class="posts">
  {% for post in site.posts %}
    <li><span>{{ post.date | date_to_string }}</span> &raquo; <a href="{{ BASE_PATH }}{{ post.url }}">{{ post.title }}</a></li>
  {% endfor %}
</ul>

## To-Do

+ Write content and a better front page :)
+ Update the theme and implement it better.
