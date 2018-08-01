---
layout: post
title: "Internationalized domain names ...in Linux"
description: "How can you use IDNs in Linux in 2018"
category: "Linux"
tags: [Linux, DNS]
---

The Internet was made for Latin script, more specifically a-z, 0-9 and a hyphen. Of course, I'm talking about Internet addresses, which is exactly how you reach content online. The problem is that around 2 billion people actually use Chinese, Arabic, Devanagari, Cyrillic and other writing systems. Even the French, Germans and Romanians have non-latin characters so let's see how those are handled online.

I got the domain `ă.cc`. How can I use it?

![IDNs map]({{ site.url }}/assets/img/IDNs.jpg)

### Some background info

The DNS, which is the system that helps us get around online using names instead of IP addresses is restricted to only ASCII characters. It makes sense to me because:
* The Americans who invented DNS can't really be blamed that they didn't think of characters they didn't understand.
* Coordinating the update of many servers on the Internet to support some major new feature is not reasonable.
* Adding UTF-8 could be a huge liability. It has some strange characters such as **blank** and **go back one character**. This would open interesting possibilities.

Nevertheless, in 1996 a guy from Zurich felt that we need domains with all types of characters so he wrote [a draft](https://tools.ietf.org/html/draft-duerst-dns-i18n-00). People implemented, debated and more than a decade later, [in 2009 ICANN brought the languages of the world to the global Internet](https://www.icann.org/news/announcement-2009-10-30-en).

Internationalized domain names (IDNs for short) are domain names which use non-ASCII characters and could be helpful to more than 30% of the world population. 

But all this time DNS didn't change, so how does this work?!

At some point, [some guy proposed a standard](https://tools.ietf.org/html/rfc3492) for converting any character (Unicode) into ASCII. This is called Punycode. For my domain, `ă.cc`, Punycode looks like `xn--0da.cc`. The character `ă` is actually `0da`. `xn--` tells applications this is Punycode.

So, IDNs are implemented at the application level. Internet Explorer started to support this late 2006 and others a little bit earlier but it seems that 12 years later, support is poor in pretty much any other basic tool.

### The Linux situation

* SSH, traceroute and many others don't support IDNs.
* The browsers, nslookup and dig are OK.

1. The thing that handles resolving domain names in Linux is `glibc`, which has some resolver code copied mostly from BIND. BIND is that DNS server which we talked about in the beginning, that only supports ASCII.
2. Pretty much all programs link against `glibc` and when they need to resolve some address, `glibc` handles it for them.
3. There is a library in Linux, called `libidn`, which handles the conversion to Punycode. 
4. ```
nimblex:~# ldd /usr/bin/nslookup 
	linux-vdso.so.1 (0x00007ffc3dde8000)
	libedit.so.0 => /usr/lib64/libedit.so.0 (0x00007fed5f979000)
	libdns.so.1100 => /usr/lib64/libdns.so.1100 (0x00007fed5f551000)
	liblwres.so.160 => /usr/lib64/liblwres.so.160 (0x00007fed5f33e000)
	libbind9.so.160 => /usr/lib64/libbind9.so.160 (0x00007fed5f12d000)
	libisccfg.so.160 => /usr/lib64/libisccfg.so.160 (0x00007fed5ef01000)
	libisc.so.169 => /usr/lib64/libisc.so.169 (0x00007fed5ec89000)
	libcrypto.so.1.1 => /lib64/libcrypto.so.1.1 (0x00007fed5e802000)
	libcap.so.2 => /lib64/libcap.so.2 (0x00007fed5e5fd000)
	libjson-c.so.4 => /usr/lib64/libjson-c.so.4 (0x00007fed5e3ee000)
	libpthread.so.0 => /lib64/libpthread.so.0 (0x00007fed5e1cf000)
	libxml2.so.2 => /usr/lib64/libxml2.so.2 (0x00007fed5de6a000)
	libz.so.1 => /lib64/libz.so.1 (0x00007fed5dc53000)
	liblzma.so.5 => /lib64/liblzma.so.5 (0x00007fed5da2d000)
	libm.so.6 => /lib64/libm.so.6 (0x00007fed5d692000)
	libdl.so.2 => /lib64/libdl.so.2 (0x00007fed5d48e000)
	libidn.so.12 => /usr/lib64/libidn.so.12 (0x00007fed5d25a000)
	libc.so.6 => /lib64/libc.so.6 (0x00007fed5ce70000)
	libncurses.so.6 => /lib64/libncurses.so.6 (0x00007fed5cc46000)
	libtinfo.so.6 => /lib64/libtinfo.so.6 (0x00007fed5ca1a000)
	/lib64/ld-linux-x86-64.so.2 (0x00007fed5fbb1000)
```
nslookup links against libidn and that's why it can resolve my domain; `ă.cc`

Now a few things come to mind:

* link `glibc` against `libidn` to support resolving internationalized domains names. Well, this is stupid because `glibc` is primordial. `libidn` links to it, not the other way around.
```
nimblex:~# ldd /usr/lib64/libidn.so.12
	linux-vdso.so.1 (0x00007ffe1cbdc000)
	libc.so.6 => /lib64/libc.so.6 (0x00007fc7f9785000)
	/lib64/ld-linux-x86-64.so.2 (0x00007fc7f9da3000)
```
* merge `glibc` and `libidn`. It seems this [was done](https://ftp.gnu.org/gnu/libc/glibc-libidn-2.10.1.tar.bz2) before ICAN made their grand announcement, almost a decade ago, but then abandoned.
* link tools like ping, ssh and others against `libidn`. 
  * it looks like for ping, libidn was [encouraged since 2015](https://github.com/iputils/iputils/commit/f3a461603ef4fb7512ade3bdb73fe1824e294547) but many distros don't support it yet. Still, I'm sure ping will support IDNs in most distros soon.
  * for ssh the territory is virgin.

### Conclusion

In 2018 we have AI which recognizes my face better than my family but most tools don't work with domains such as `рнидс.срб`. It seems seriously limiting and I don't like that. I guess I will start bothering some people about this.
