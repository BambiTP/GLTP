# This script is used to update the map_metadata.json (used with the presets.json) file with the latest
# map difficulty and balls required data from the Google Sheet.
import requests
import json
import io
import csv

"""Splits the categories from spreadsheet into an array based on comma separation.
Example: 'Solo, Checkpoint, Unlimited Jumps, Reversed' = [Solo, Checkpoint, Unlimited Jumps, Reversed]
"""
def split_categories(category_row):
    if not category_row:
        return []
    return [category.strip() for category in category_row.split(',')]

def split_pseudo_map_ids(pseudo_map_id_row):
    """
    Splits the Pseudo Map ID column into an array based on comma separation.
    Example: '12345, 67890, CustomName' = ['12345', '67890', 'CustomName']
    Returns empty array if the cell is empty.
    """
    if not pseudo_map_id_row:
        return []
    return [map_id.strip() for map_id in pseudo_map_id_row.split(',') if map_id.strip()]

def derive_completion_type(team_caps_value):
    """
    Derive completion_type from the Team Caps column.
    If the value is truthy ("true", "yes", "1"), return "individual".
    Otherwise (null, empty, anything else), return "combined".
    """
    val = str(team_caps_value or "").strip().lower()

    if val in ("true", "yes", "1"):
        return "combined"
    return "individual"

def derive_caps_to_win(value):
    """
    Derive caps_to_win from the Caps To Win column.
    If the value is a number or a string number, return it as a string (including "-1").
    Otherwise (null, empty, anything else), return "1".
    """
    if value is None:
        return "1"

    val_str = str(value).strip()

    # Accept integers, including negative ones like -1
    try:
        num = int(val_str)
        return str(num)
    except ValueError:
        # Not a valid integer string
        return "1"
    
def derive_allow_blue_caps(value):
    """
    Derive allow_blue_caps from the Allow Blue Caps column.
    If value is "true" or "TRUE" (case-insensitive), return True.
    Otherwise return False.
    """
    if isinstance(value, str) and value.strip().lower() == "true":
        return True
    return False

def derive_laps(value):
    """
    Derive laps from the Laps column.
    If value is "spawn" or "grab" (case-insensitive), return value.
    Otherwise return False.
    """
    if isinstance(value, str) and (value.strip().upper() == "SPAWN" or value.strip().upper() == "GRAB"):
        return value.strip().upper()
    return False

def get_map_metadata():
    # URL for the Google Sheet export
    url = "https://docs.google.com/spreadsheets/d/1OnuTCekHKCD91W39jXBG4uveTCCyMxf9Ofead43MMCU/export"

    # Parameters for the export
    params = {
        "format": "csv",
        "id": "1OnuTCekHKCD91W39jXBG4uveTCCyMxf9Ofead43MMCU",
        "gid": "1775606307"  # This is the gid for the Map Difficulty BackEnd tab
    }

    # Fetch the data
    response = requests.get(url, params=params)
    response.encoding = "utf-8"  # ensure correct decoding
    csv_file = io.StringIO(response.text, newline="")

    # Read the CSV
    reader = csv.DictReader(csv_file)

    # Process the data
    map_metadata = {}
    for row in reader:
        map_full = row["Map / Player"]
        if map_full == "":
            break

        if " by " in map_full:
            map_name, map_author = map_full.rsplit(" by ", 1)
        else:
            map_name, map_author = map_full, None

        map_metadata[row["Map ID"]] = {
            "map_name": map_name,
            "author": map_author,
            "difficulty": row["Average\nRating"],
            "difficultyFinal": row["Final Rating"],
            "balls_req": row["Min\nBalls \nRec"],
            "preset": row["Group Preset"],
            "map_id": row["Map ID"],
            "equivalent_map_ids": split_pseudo_map_ids(row["Pseudo \nMap ID"]),
            "categories": split_categories(row["Category"]),
            "grav_or_classic": row["Grav or\nClassic"],
            "caps_to_win": derive_caps_to_win(row["Num\nof caps"]),
            "completion_type": derive_completion_type(row["Team\nCaps"]),
            "allow_blue_caps": derive_allow_blue_caps(row["Allow Blue Caps"]),
            "allow_from_spawn": derive_allow_blue_caps(row["From Spawn"]),
            "allow_from_grab": derive_allow_blue_caps(row["From Grab"]),
            "laps": derive_laps(row["Laps"]),
        }

    # Save to a JSON file
    with open("map_metadata.json", "w", encoding="utf-8") as f:
        json.dump(map_metadata, f, ensure_ascii=False, indent=4)

    print(f"Saved metadata for {len(map_metadata)} maps to map_metadata.json")



if __name__ == "__main__":
    """
    This script is used to update the map_metadata.json file with the latest
    map difficulty and balls required data from the Google Sheet.
    """
    get_map_metadata()
