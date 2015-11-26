from __future__ import division
import HTMLParser
import requests
import time
import re

CURRENCY_URL = "http://steamcommunity.com/market/priceoverview/?currency={}&appid={}&market_hash_name={}"
MARKET_URL = "http://steamcommunity.com/market/search/render/?query=&start=0&count=1&search_descriptions=0&sort_column=price&sort_dir=desc"
data = requests.get(MARKET_URL).json()
item_url = re.findall("href=\"(.+?)\" id=", data['results_html'])[0]
item_hash = item_url.split('/')[-1]
item_appid = item_url.split('/')[-2]
parser = HTMLParser.HTMLParser()

CURRENCIES = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 20, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]
CURRENCIES.reverse()

prices = []
while CURRENCIES:
    i = CURRENCIES.pop()
    url = CURRENCY_URL.format(i, item_appid, item_hash)
    r = requests.get(url)

    if r.status_code != 200:
        print i, "bad status code"
        CURRENCIES.append(i)
        time.sleep(10)
        continue

    try:
        data = r.json()
    except:
        print i, "non json:", r.content
        continue

    if 'success' in data and not data['success']:
        print i, "success false"
        continue

    if 'lowest_price' not in data:
        print i, "no lowest price"
        continue

    price = data.get('lowest_price')
    price = parser.unescape(price)
    price = re.sub('[^0-9]', '', price)
    price = int(price)
    if i == 5:
        price *= 100
    prices.append(price)
    print i, "added"

for p in prices:
    r = round(p / prices[0], 4)
    print r

raw_input()
