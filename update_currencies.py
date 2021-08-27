from __future__ import division
from html.parser import HTMLParser
import requests
import time
import re

CURRENCY_URL = "http://steamcommunity.com/market/priceoverview/?currency={}&appid={}&market_hash_name={}"
MARKET_URL = "http://steamcommunity.com/market/search/render/?query=&start=0&count=1&search_descriptions=0&sort_column=price&sort_dir=desc"
data = requests.get(MARKET_URL).json()
item_url = re.findall("href=\"(.+?)\" id=", data['results_html'])[0]
item_hash = item_url.split('/')[-1]
item_appid = item_url.split('/')[-2]
parser = HTMLParser()

CURRENCIES = [1, 32, 34, 21, 7, 20, 4, 25, 23, 27, 40, 3, 2, 29, 10, 35, 24, 8, 16, 38, 37, 19, 11, 9, 22, 26, 12, 6, 39, 5, 31, 13, 14, 17, 30, 18, 41, 15, 28]
CURRENCIES.reverse()

print('using', item_url)

prices = []
while CURRENCIES:
    i = CURRENCIES.pop()
    url = CURRENCY_URL.format(i, item_appid, item_hash)
    r = requests.get(url)

    if r.status_code != 200:
        print(i, "bad status code, waiting 60s")
        CURRENCIES.append(i)
        time.sleep(60)
        continue

    try:
        data = r.json()
    except:
        print(i, "non json:", r.content)
        continue

    if 'success' in data and not data['success']:
        print(i, "success false")
        continue

    if 'lowest_price' not in data:
        print(i, "no lowest price")
        continue

    price_str = data.get('lowest_price')
    price = parser.unescape(price_str)
    price = re.sub('[^0-9]', '', price)
    price = int(price)
    if i == 4:
        price *= 100
    prices.append(price)
    print(i, price_str)

for p in prices:
    r = round(p / prices[0], 4)
    print(r)

input()
