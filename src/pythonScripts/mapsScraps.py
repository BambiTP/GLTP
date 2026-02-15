import requests
from bs4 import BeautifulSoup
import time

START_ID = 90900

END_ID = 95085  # change this to however far you want to search
BASE_URL = "https://fortunatemaps.herokuapp.com/map/{}"

SEARCH_TERM = "downfall"

for map_id in range(START_ID, END_ID + 1):
    url = BASE_URL.format(map_id)
    
    try:
        response = requests.get(url, timeout=10)
        
        if response.status_code != 200:
            print(f"[{map_id}] Skipped (status {response.status_code})")
            continue
        
        soup = BeautifulSoup(response.text, "html.parser")
        title = soup.title.string.strip() if soup.title else ""
        
        print(f"[{map_id}] {title}")
        
        if SEARCH_TERM.lower() in title.lower():
            print(f"\n✅ FOUND MATCH at {url}")
            #break

        time.sleep(2)  # be polite to the server
        
    except Exception as e:
        print(f"[{map_id}] Error: {e}")
