---
layout: post
title: "Automating SurveyMonkey Responses"
description: "Learning Selenium for having a bit of jerk fun"
category: "Automation"
tags: [Automation, Selenium, SurveyMonkey]
---

I wanted to give [Selenium](http://www.seleniumhq.org) a try for a while and I just found the perfect pretext:
earn enough votes in a SurveyMonkey poll to win a bottle of cognac.

### Constrains

The automation has to work on SurveyMonkey because this was the chosen poll system. After some initial checking it was clear this one has some security checks in place so that makes it even more fun.

### Why this works


We will instantiate an incognito browser every time so cookies will not be saved and we can run this over and over again. This will be a real browser which will receive simulated clicks on HTML elements so it will be hard to detect it's automated.

Also, SurveyMonekey has an option to check if voting is done from the same IP address. In this case the option was not used so unfortunately this was quite easy.

### Code

```python
import time
from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
chrome_options = webdriver.ChromeOptions()
chrome_options.add_argument("-incognito") 
driver = webdriver.Chrome(executable_path='/usr/lib64/chromium/chromedriver', chrome_options=chrome_options)
driver.get('https://www.surveymonkey.com/r/YD6G9PT')
vote_check = driver.find_element_by_xpath(".//*[@id='question-field-96043893']/fieldset/div/div/div[1]/div/label/span[1]")
vote_check.click()

vote_done = driver.find_element_by_xpath("//button[contains(text(), ' Done')]")
vote_done.click()

time.sleep(3)

driver.quit()
```

Obviously you have to replace the survey URL and the ID of the question. [HERE](http://selenium-python.readthedocs.io/locating-elements.html) you can find a starting point regarding how we locate the clickable elements.

Installing selenium is easy with `pip3 install selenium`.

And to run it, all you have to do is: `python3 win.py`

#### Before applying jerk script

![SurveyMonkey - Before]({{ site.url }}/assets/img/SurveyMonkey-before.png)

#### After applying jerk script

![SurveyMonkey - After]({{ site.url }}/assets/img/SurveyMonkey-after.png)

### Wear protection

It seems there is an option to send the survey by email, and not by a web link. If you send the survey by email you are doing two things:

1. You are giving SurveyMonkey the email address of your respondents (**not cool**)
2. You are allowing SurveyMonkey to generate links for each email address (**cool**)

##### Notes:

I actually ran the automation after the winner was chosen.

It works well in March 2017 but it's likely it will have to be adjusted at some point if SurveyMonkey will make changes to their system.
