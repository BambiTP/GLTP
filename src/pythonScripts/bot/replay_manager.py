import time
import requests
import json
import os

from maps import get_maps

import requests
import logging

PARSE_ENDPOINT = "https://gltp.fwotagprodad.workers.dev/parse"
RECORDS_URL = "https://gltp.fwotagprodad.workers.dev/records"
ORIGIN = "grav bot"

logger = logging.getLogger("replay_manager")

# Cache for WR data
_wr_cache = None
_wr_cache_timestamp = 0
WR_CACHE_TTL = 60 * 60 * 3  # 3 hours

def upload_replay_uuid(uuid: str) -> dict:
    """
    Upload a replay UUID to the Cloudflare Worker endpoint.

    Args:
        uuid (str): The game UUID.

    Returns:
        dict: Response JSON from the Worker, or an error dict.
    """
    try:
        payload = {"input": uuid, "origin": ORIGIN}
        res = requests.post(PARSE_ENDPOINT, json=payload, timeout=45)
        if res.status_code == 201:
            data = res.json()
            logger.info(f"✅ Inserted {uuid}")
            return {"ok": True, "status": "inserted", "summary": data.get("summary")}
        elif res.status_code == 200:
            data = res.json()
            logger.info(f"✅ Inserted {uuid}")
            return {"ok": True, "status": "inserted", "summary": data.get("summary")}
        elif res.status_code == 409:
            data = res.json()
            logger.info(f"⚠️ Duplicate {uuid}")
            return {"ok": False, "status": "duplicate", "summary": data.get("summary")}
        else:
            logger.error(f"❌ Upload failed for {uuid}: {res.status_code} {res.text}")
            return {"ok": False, "status": "error", "error": res.text, "code": res.status_code}
    except requests.RequestException as e:
        logger.error(f"❌ Request exception for {uuid}: {e}")
        return {"ok": False, "status": "error", "error": str(e)}

def write_replay_uuid(uuid, onlyLog=False):
    if onlyLog:
        with open("replay_uuids.txt", "a") as f:
            f.write("\n" + uuid.strip())
        f.close()
    else:
        upload_replay_uuid(uuid.strip())

def refresh_wr_cache(force=False):
    """Fetch WR data from Cloudflare and cache it."""
    global _wr_cache, _wr_cache_timestamp
    now = time.time()
    if force or _wr_cache is None or (now - _wr_cache_timestamp) > WR_CACHE_TTL:
        try:
            res = requests.get(RECORDS_URL, timeout=10)
            res.raise_for_status()
            _wr_cache = res.json()
            _wr_cache_timestamp = now
            logger.info(f"✅ WR cache refreshed with {len(_wr_cache)} records")
        except requests.RequestException as e:
            logger.error(f"❌ Failed to refresh WR cache: {e}")
            _wr_cache = None
    return _wr_cache

def get_wr_entry(map_id: str, records):
    """Return the best WR entry for a given map_id from cached Cloudflare records."""
    #records = refresh_wr_cache()
    if not records:
        return None

    # records is assumed to be a list of dicts with keys like map_id, record_time, etc.
    map_entries = [entry for entry in records if entry.get("map_id") == map_id and entry.get("record_time")]
    if not map_entries:
        return None

    return min(map_entries, key=lambda e: e["record_time"])
