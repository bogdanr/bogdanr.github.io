---
layout: post
title: "Operating Systems hidden on your PC"
description: "Besides your main Operating System your computer runs at least two other lower level OSs."
category: "security"
tags: [security, computers]
---

Whether you use a Mac or PC with Windows or Linux, your Intel computer runs some other operating systems in the background without bothering you with this piece of information. These OSs run all the time, have amazing capabilities and are impossible to remove.

Some time ago, computer scientists devised a mechanism called [protection rings](https://en.wikipedia.org/wiki/Protection_ring) which has the purpose of allowing operating systems limit access to resources. It goes from ring 0 (most privileges) to ring 3 (least privileges). For example, the kernel of your operating system runs at ring 0 and your web browser at ring 3. The kernel should have the capability to access all the RAM to allocate it to different programs, but your web browser should not be able to read the memory of your bitcoin wallet software.

Then it came hardware virtualization and that hypervisor runs one level below the kernel so that the guest OS can run just as before. We call this ring -1.

Bellow ring -1 there are many other things lurking in the shadows.
![UEFI Boot]({{ site.url }}/assets/img/firmware-trojan.jpg)

### System Management Mode (SMM)

This is a special operating mode of your CPU, which runs code from the firmware completely independent of the Operating System. Some people call this ring -2.

It does things such as:
* control fans or shut down the computer when the CPU overheats
* resume the OS from standby when the laptop lid is open
* emulate a USB keyboard as PS/2 so it can be used in a super legacy OS like DOS
* control voltage regulators to manage how much power your CPU gets
* vendors use it to implement features specific to their devices

![UEFI Boot]({{ site.url }}/assets/img/SMM.jpg)

SMM was designed so it can't be overwritten by the main OS when it's enabled and it reserves 8MB of RAM which is not visible anymore.

SMM runs the vendor code all the time and you can't do much about it. You don't see what and when it runs and it has excellent control over USB or other peripherals.

The code that runs in SMM takes time away from applications and in current implementations, it switches all the cores even to add 1+1.

But of course, you should trust your vendor will do a good job here. It's not like [NSA exploited SMM](https://leaksource.wordpress.com/2013/12/30/nsas-ant-division-catalog-of-exploits-for-nearly-every-major-software-hardware-firmware/) against the most reputable vendors like Dell, HP and Juniper.

### Unified Extensible Firmware Interface (UEFI)

The word "extensible" sounds good in general, but not so good for things you want to be specific, simple and secure.

This is a piece of software that replaces the BIOS which has some limitations such as it can only run in 16bit mode, address 1MB of memory and use up to 2TB drives. The specification was originally developed by Intel but in 2005 this responsibility was transferred to the [UEFI Forum](http://www.uefi.org/members). 

The main features of UEFI I would like to debate are:
1. CPU independent device drivers
2. The possibility to run EFI applications
3. Graphical features which allow having a GUI before loading the OS
4. Network booting (PXE)
5. Secure Boot

This list of advantages sounds like having an Operating System?! 

Let's take this great features one at a time:
1. Universal drivers should be a great feature. I speculate that many of these drivers could be used by the main OS directly through the UEFI API. The truth is this most often they are implemented twice; once for firmware and once for the OS.
2. The application I willingly run is the GRUB boot loader which gives me flexibility when I start my operating system. I can't think of anything more that I would want to run at this stage so I can't appreciate this capability too much.
3. I don't really need anything before I load the OS. I only need my OS to load fast so I wouldn't mind a couple of seconds of black screen before the kernel of my OS initializes the display.
4. Network booting is a neat feature. I have also used it in the days of the BIOS when network cards had [a dedicated chip](https://en.wikipedia.org/wiki/Option_ROM) which included the software implementation for doing that. This feature allowed me to either run stateless machines without HDDs or to automatically install the OS without handling CDs. My concern now is that in the context of UEFI, this means an obscure application can communicate over the network and applications now are not limited like they used to be.
5. Secure boot is complete bullshit! It was mostly used by Microsoft to restrict people to only use the Windows which comes preinstalled. It restricts the firmware to only load a kernel signed with a private key which corresponds to a public key which is loaded in the firmware.

Now let me tell you another concept. In UEFI there are **boot services** and **runtime services**. The boot services run until your operating starts loading and runtime services run also when your OS is running.

![UEFI Boot]({{ site.url }}/assets/img/UEFI-Boot.gif)

Most of UEFI is closed source and only the vendor knows what's there. Some parts of it are OpenSource but basically that [doesn't make a difference for the end user](https://github.com/tianocore/tianocore.github.io/wiki/EDK-II-Platforms).

In a nutshell, UEFI is an extremely complex proprietary kernel which runs on the main CPU even while your OS is running. Exploits [where demonstrated](https://www.cylance.com/en_us/blog/uefi-ransomware-full-disclosure-at-black-hat-asia.html) this year which work even when updates and security measures are in place.

### Intel Management Engine (Intel ME)

This is the masterpiece. RING -3

**It is a separate processor core embedded in the CPU package, with internal ROM, RAM and DMA (direct memory access) to the main system memory.** In addition to that, it **has network access** with its own MAC address through the ethernet controller.

When you apply power, the first thing that starts is ME, which loads its firmware from the flash chip where you usually also have the UEFI firmware and SMM stuff. Parts of this firmware are signed by Intel and if it doesn't find what it expects it either doesn't start the main CPU or it reboots the computer every 30 minutes.

One *nice* component of ME is Active Management Technology (AMT) which **can be used remotely even when the PC is turned off**.

Another *nice* one is Protected Audio Video Path (PAVP) which allows ME to communicate with the GPU so it can read and write to the screen. I wonder about the audio capabilities which are hinted in the name.

In a nutshell, ME is the *nicest* control tool which runs a proprietary MINIX based OS that can do everything on your computer:
* power ON/OFF
* access all memory
* view/paint your screen
* read your keystrokes
* ... ?!

Having so *nice* features it was surely bound to be [vulnerable for 9 years](https://www.intel.com/content/www/us/en/architecture-and-technology/intel-amt-vulnerability-announcement.html). If you have an i3, i5 or i7 computer bought before the end of 2017 then **you are likely vulnerable**.

If you want to know more, in the [PCH datasheet](https://www.intel.com/content/dam/www/public/us/en/documents/datasheets/9-series-chipset-pch-datasheet.pdf) at chapter 5.25 you can see a short overview. The PCH is the die on the right side of the image below.
![UEFI Boot]({{ site.url }}/assets/img/broadwell-u.jpg)

### Can we do something about it?

Technically speaking, the options are very limited. 
All these *beautiful things* are burned on a flash chip like this one you can see on the right side of the CPU in my PC.
![UEFI Boot]({{ site.url }}/assets/img/ThinkPad-X1.jpg)

In theory, we could do the following:
0. Disable parts of ME with [this Linux tool](https://github.com/intel/INTEL-SA-00075-Linux-Detection-And-Mitigation-Tools) or [the Windows one](https://downloadcenter.intel.com/download/26754).
1. Buy a SPI flash programmer to dump all the firmware.
2. Use [me_cleaner](https://github.com/corna/me_cleaner) to remove a good part of the ME firmware.
3. Flash the minimized firmware back to that chip.
4. Hope for the best
5. To improve the UEFI and SMM issue, it's going to be much harder. You'll have to learn about [heads](https://github.com/osresearch/heads), [coreboot](https://www.coreboot.org/), the UEFI specifications. Then you'll have to build a custom UEFI of your own which will start a Linux kernel very early on (at BDS stage). This kernel would take a good chunk of the EFI responsibility and it could also run your Linux OS. For me, it will be a little more difficult because I have 32bit UEFI and it would only start a 32bit kernel which I could then use to start the main OS kernel.

... or maybe I will just buy a [Purism](https://puri.sm/) computer next time.

If you are a Windows or MAC user, I think your only option is to complain to the government. Spreading awareness is something that I am sure you can do.

We only talked about Intel here but AMD does something similar. Chromebooks are a little less affected by this but they only run Google stuff.

### Conclusion

Most of us are always running a version of MINIX on their computers, which [makes Tanenbaum very happy](http://www.cs.vu.nl/~ast/intel/) because MINIX is used more than Windows, Linux or MacOS.

To access AMT you can use the user "admin" with an empty password and you have complete control. The right janitor in the wrong network would make  a very interesting story.

We also run UEFI and SMM stuff all the time which was proven to be exploited very effectively [time](https://www.cylance.com/en_us/blog/uefi-ransomware-full-disclosure-at-black-hat-asia.html) and [time](https://leaksource.files.wordpress.com/2013/12/nsa-ant-ironchef.jpg) again.
