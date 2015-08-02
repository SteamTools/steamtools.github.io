from __future__ import division
import HTMLParser
import requests
import re

CURRENCY_URL = "http://steamcommunity.com/market/priceoverview/?currency={}&appid={}&market_hash_name={}"
MARKET_URL = "http://steamcommunity.com/market/search/render/?query=&start=0&count=1&search_descriptions=0&sort_column=price&sort_dir=desc"
data = requests.get(MARKET_URL).json()
item_url = re.findall("href=\"(.+?)\" id=", data['results_html'])[0]
item_hash = item_url.split('/')[-1]
item_appid = item_url.split('/')[-2]
parser = HTMLParser.HTMLParser()

CURRENCIES = [1, 2, 3, 5, 7, 8, 9, 10, 11, 12, 13, 14, 17, 19, 20, 22]
prices = []
for i in CURRENCIES:
    url = CURRENCY_URL.format(i, item_appid, item_hash)
    data = requests.get(url).json()
    price = data.get('lowest_price')
    price = parser.unescape(price)
    try:
        print unicode(price)
    except:
        pass

    price = re.sub('[^0-9]', '', price)
    price = int(price)
    if i == 5:
        price *= 100
    prices.append(price)

ratios = []
for p in prices:
    r = round(p / prices[0], 4)
    ratios.append(r)

print ratios
raw_input()
