---
layout: post
title: "Power meter for the entire apartment"
description: "Monitoring the energy usage in realtime to improve the understanding of energy consumption"
category: "DIY"
tags: [DIY, ESP8266, Automation, IoT]
---

In the weekend I wanted to do something fun for improving the visibility of energy consumption. I ended up with a nice LED display that shows usage in realtime and some cool charts on my phone.

### Principle of operation

We learned in middle school that current passing through a wire generates a magnetic field and that a magnetic field passing through a wire generates electricity. Later I learned that this is the basic principle of [the transformer](https://en.wikipedia.org/wiki/Transformer). [Our current sensor is essentially a transformer](https://en.wikipedia.org/wiki/Current_clamp#Current_transformer) which generates a voltage across a burden resistor proportional to the current passing through the wire we are clamping the sensor to.

![Current transformer]({{ site.url }}/assets/img/Current-transformer.gif)

Now we need to read the voltage from the sensor and do some calculations to determine the power usage.

Since our voltage is AC, it has negative values and we would have to add a DC offset to it so the alternation would only happen above zero.
![Current clamp circuit]({{ site.url }}/assets/img/DC-offset.jpg)

Our microcontroller has an ADC which would convert the voltage value to a numerical value depending on it's resolution. A 10bit resolution could have a value between 0-1023.

Finally, the circuit going to our ADC looks something like this:
![Current clamp circuit]({{ site.url }}/assets/img/AC-current-input.png)

### Implementation

Our BOM (Bill of materials) is short and cheap (~$20):
1. **Microcontroller**: Wemos D1 mini
2. [**CT Sensor**](https://learn.openenergymonitor.org/electricity-monitoring/ct-sensors/introduction): YHDC SCT-013-000
3. **Display**: Dot matrix with MAX7219 driver
4. **Power supply**: HLK-PM03

Yeah, I am a fan of the [ESP8266](http://bogdan.nimblex.net/diy/2016/10/29/iot-fuzzy-clock.html) microcontroller even though it doesn't have the best ADC. Still, it has WiFi and works well with the Arduino SDK.

To determine the burden resistor for the CT sensor **we have two options**:
##### Do some math

1. Assuming we want to measure up to 9kW then the peak current would be: `9000/230=39.13 ~ 40A`
2. Since we have AC, we have to multiply with √2 to get peak values: `40A × 1.414 = 55.33A`
3. Our sensor is rated 50mA on the secondary for 100A on the primary so we have `100 x 1000 / 50 = 2000` turns.
4. The peak current we can expect on the secondary will be: `55.33A / 2000 = 0.0276A`
5. Now the burden resistor should be chosen so that voltage doesn't go over half of 3.3V: `3.3 V / 2 / 0.0276 A = 59.7 Ω`
This is close to 56Ω which is a [common value](https://ecee.colorado.edu/~mcclurel/resistorsandcaps.pdf) so we can choose that.

##### Do some measurements

Took out the old scope and measured Vpp with various burden resistors and with all the major appliances running. ;)
![Energy monitor oscilloscope]({{ site.url }}/assets/img/Power-usage-scope.jpg)
WTF is this?! [Where is my sine wave](https://learn.openenergymonitor.org/electricity-monitoring/ac-power-theory/introduction)?! Yeah, with all those reactive and non-liner loads (Fridge, TV, CFL and LED bulb, computers, etc) it will not look like a sine wave. If I plug everything off and only run the stove or some other resistive load it looks like a very pretty sine wave but with normal devices, never.

It seems that the sweetspot is `2 x 47Ω` and adding all the running appliances sums up to ~6kW. I added a calibration feature in the Android app anyways and this way we could get slightly better results.

After a bit of soldering and coding, our prototype looks like this:
![Energy monitor prototype]({{ site.url }}/assets/img/Power-usage-prototype.jpg)

Here my meter is measuring 1525Wh and the commercial thing I have is measuring 1550Wh. The error margin is less than 2% so I'm happy with this result. We don't know how well the commercial meter is calibrated anyways.


#### Code

The SDK we are going to use is Arduino and a bunch of libs that make things simple.

* [Blynk](https://github.com/blynkkk/blynk-library/releases/) will help us with the Andorid app and communications through Internet.
* ArduinoOTA will allow us to do wireless firmware updates.
* [MAX7219_Dot_Matrix](https://github.com/nickgammon/MAX7219_Dot_Matrix) is obviously the lib which *paints* the display.
* [EmonLib](https://github.com/openenergymonitor/EmonLib) does all the math for energy monitoring.

<script src="https://gist.github.com/bogdanr/907f819876231cc2fc72b5f727ffe68c.js"></script>

After the prototype testing I installed it in the fuse box and it looks like this:
![Energy monitor installed]({{ site.url }}/assets/img/Power-usage-installed.gif)

... and the Android app looks like this:
![Energy monitor android]({{ site.url }}/assets/img/Power-usage-android.jpg)

### Possible improvements 

* Add more channels.
* Improve the resolution.
* Predict the cost.

The ESP8266 has a single 1V, 10bit ADC built in. This isn't great if you want precision. Using an external ADC such as [ADS1115](http://www.ti.com/lit/ds/symlink/ads1113.pdf) would allow us to go to 4 channels, 5V and 16 bit. It would be a huge step up and just a small increase in cost.
