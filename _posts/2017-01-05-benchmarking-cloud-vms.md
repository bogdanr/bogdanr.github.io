---
layout: post
title: "Benchmarking Cloud VMs"
description: "Price vs performance analysis for some cloud computing proviers"
category: "Cloud"
tags: [Cloud, VMs, Compute, AWS, Amazon, Google, Linode, Digital Ocean]
---

Once in a while I compare the performance vs cost benefits of cloud vendors. In this case I just need to compare virtual machines, which is by far the most used service out there, so I guess sharing these results should be useful to many people.

### Constrains

I am automating things are a pretty high degree so the vendors I am looking at should have a decent API that would allow me to create and destroy servers without ever going into the web admin interface.

I only care about compute for this project so we are only comparing that. There will be no added value if a vendor has features that we don't use.

### Methodology

By analyzing the offerings, I will choose some vendors and an instance type that is equivalent and the most cost effective.

Thus, the chosen instance size was 8G RAM and 4 vCPUs and the vendors are:

+ Amazon Web Services
+ Google Compute Engine
+ Digital Ocean
+ Linode

We will test, CPU, Disk IO, memory and network bandwidth.

#### Environment

All tests would be done on Debian 8 because it has fairly recent tooling and it’s a popular and well maintained distro.

`apt-get install fio sysbench ioping`

#### Disk

All the instances had 100G SSD attached.

##### Random RW
`fio --ioengine=libaio --direct=1 --bs=4k --iodepth=64 --size=5G --rw=randrw --gtod_reduce=1 --name=rw`

##### Random Read
`fio --ioengine=libaio --direct=1 --bs=4k --iodepth=64 --size=5G --rw=randread --gtod_reduce=1 --name=read`

##### Random Write
`fio --ioengine=libaio --direct=1 --bs=4k --iodepth=64 --size=5G --rw=randwrite --gtod_reduce=1 --name=write`

#### CPU

We are running the tests with a different number of threads in order to observe if performance scales well as we increase the number of cores.

These tests should be repeated a few hours apart to determine observe if the CPU performance looks predictable or if there is a big chance for noisy neighbors.

`for each in 1 2 4; do sysbench --test=cpu --cpu-max-prime=20000 --num-threads=$each run|grep "execution time"; done`

#### Memory
`sysbench --test=memory --num-threads=4 run | grep "execution time"`

#### Bandwidth

+ On machine A
`iperf -s -p 81`

+ On machine B
`iperf -c 10.150.0.146 -i 1 -t 60 -V -p 81`


### Results

![CPU time to compute large Pi]({{ site.url }}/assets/img/cloud-performance/CPU-Pi.png)
![MySQL Performance]({{ site.url }}/assets/img/cloud-performance/MySQL.png)
![Internal Network Speed]({{ site.url }}/assets/img/cloud-performance/Network.png)
![IO Performance]({{ site.url }}/assets/img/cloud-performance/IOperformance.png)
![Cost]({{ site.url }}/assets/img/cloud-performance/Cost.png)

##### Notes:

Amazon and Google both limit IO performance according to disk size. They both can perform very well with way more expensive storage.

## Conclusions:

+ There is a huge difference in the cloud offering.
+ Compute at Amazon is very expensive compared with others.
+ Out of these 4 vendors Linode is by far the cheapest as of January 2017.

