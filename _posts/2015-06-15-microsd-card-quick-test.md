---
layout: post
title: "MicroSD card quick test"
description: "This is a quick test with the write speed of some MicroSD cards"
category: "gadgets"
tags: [MicroSD, action cam, benchmark, dd]
---
{% include JB/setup %}

![MicroSD card]({{ site.url }}/assets/img/microsd-cards.png)

MicroSD cards are everywhere these days but since these days it's possible to film in UHD or in high speed with action cameras and phones it's actually very important how quick these cards are at writing this data. Of course these cards could also be used as storage for all those boards which run Linux, such as the well known Raspberry Pi but in this case a durability test would be just as important as a speed test.

## Method

I took four of the MicroSD cards which I found in the house and which could be easily found in stores. I was only interested in the write speed to card so I used dd to dump data to the card.
`dd if=/dev/zero of=/root/card/testfile bs=1M count=1024 oflag=direct`

The card was tested in the SD/MMC port on the laptop, with a fast card reader in USB 2.0 and in USB 3.0. The last option was significantly faster so I used the card reader in a USB 3.0 port for all the tests.

The tests were run multiple times and the average was considered. It was proven that most cards have a very unpredictable performance. The minimum write speed can sometimes be half of the maximum speed.

## Results

{: .table .table-hover}
Lexar 633x | Sony    | Kingston Class 10 | Kingston Class 4
---------- | ------- | ----------------- | ----------------
40 MB/s    | 17 MB/s | 9.5 MB/s          | 3.5 MB/s

## Conclusion

One card can be at least 10 times slower than another so it's quite possible to get a card which is not fast enough for filming. The industry has the [UHS class 3](https://www.sdcard.org/consumers/speed/speed_class/) marking, which defines the minimum writing speed of 30MB/s, but the indication is frequently misused. I recommend you get a card which was tested by someone and has proven to be good enough.

The writing speed for the SD cards can also fluctuate quite badly so performing only one write test is not enough. Out of these 4 cards I tested, Lexar 633x was the only one which has consistent performance and it was the fastest one.
