---
layout: post
title: "Hacking the washing machine"
description: "Enabling my wife to do laundry continents away from home"
category: "DIY"
tags: [DIY, ESP8266, Automation]
---

I got the perfect washing machine in my early 20s when I was single. It has some predefined programs, no display or any other complicated features. I was using mostly "power + quick wash". Now, in my early 30s, my wife uses programs that take hours and staring them after work means the cycle would be done after midnight. So, let's make that hunk of metal controllable from the Internet.

### Step 1 - Understand how it works

At first impression all is simple. It's a relatively unknown micro with many GPIOs, some used as inputs for buttons and some to switch transistors that drive LEDs.

![Indesit SIXL control board]({{ site.url }}/assets/img/Indesit-sixl-cb1.jpg)

I got the control board out from the machine and hooked it to a bench power supply but nothing happens. Obviously there is also a power module with relays and stuff for controlling valves and the motor. It turns out that on this power module there is an EPROM which identifies the model and which allows the control board to actually run. That is not going to be an issue because we can test with the complete circuit.

Probing around with the multimeter made it clear quickly that the buttons pull GPIOs to GND. LEDs on the other hand, are NOT connected to GND or to a voltage rail directly through a resistor. The LEDs are connected to GND through individual transistors and power is applied to all of them through another transistor.

Doing a bit more investigation, seems that there are a lot of failsafe mechanisms so the machine wouldn't run with a jammed engine or failed valves. Still, we don't care about all that so we move on.

### Step 2 - Interface a wireless microcontroller

Our microcontroller of choice is going to be the notorious [ESP8266](http://bogdan.nimblex.net/diy/2016/10/29/iot-fuzzy-clock.html) for obvious reasons; it has builtin WiFi, it's cheap, easily available and works well with easy to use SDKs such as Arduino. It has some minor shortcomings, such as it's logic is 3.3V while the micro in the washing machine is 5V. That it's easy to overcome with some simple voltage dividers or a level shifter circuit so we move on.

We just want to do two simple things:
1. Push buttons to actually start wash cycles.
2. Read LEDs so that we know remotely the state of the machine.

If we only did the button pushing thing then we would have no guaranty things are actually happening.

1. For pushing the buttons we will connect some transistors to ESP8266 and use them as a second set of switches. This will use 3 GPIOs and handle Power, the 40°C program and the 60°C program.
2. For reading the LEDs I decided to use a [level shifter](http://cdn.sparkfun.com/datasheets/BreakoutBoards/Logic_Level_Bidirectional.pdf) I had around. We will use all the 4 channels to detect the power, lock, 40° and 60° LEDs.

It would be a good idea to improve the 5V power supply included in the power module because our microcontroller draws extra 100mA and the added consumption takes us very close to the limit. Still, I will do that some other day.

### Code

The SDK we are going to use is Arduino and with just a library or two this is going to be really simple.

Blink will help us with the Andorid app and communications with the microcontroller through Internet.

WiFiManager will help us not hardcode the AP credentials in the code so that when we change the wireless router, we don't have to reflash the washing machine.


<script src="https://gist.github.com/bogdanr/1bc97fd0326df7570b609393dae8477e.js"></script>

After some testing with the ESP8266 disconnected I procedded to solder it in and it now looks like this:

![Indesit Moon hack]({{ site.url }}/assets/img/Indesit-sixl-cb2.jpg)
![Indesit Moon hack installed]({{ site.url }}/assets/img/Indesit-sixl-cb3.jpg)

### Step 3 - Enjoy 

To me, this is still the best washing machine because I don't have to buy a new one :)

![Indesit Moon hack]({{ site.url }}/assets/img/Indesit-sixl.jpg)

