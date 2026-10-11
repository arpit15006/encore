"""Build the evaluation sample from the Desert Island Discs dataset (Finnegan et al., 2021, CC BY-NC-SA 4.0).

Writes data/eval-sample.json (gitignored). Castaway names are not written: each system only ever sees
a birth year, a place of birth and three of the person's chosen artists.
"""
import ast
import json
import random
from collections import defaultdict

import openpyxl

SOURCE = "data/desert_island_discs.xlsx"
OUT = "data/eval-sample.json"
PER_GROUP = 30  # born in the UK, born elsewhere
CLASSICAL = ["classical", "opera", "baroque", "romantic era", "orchestra", "early music", "choral", "late romantic", "impressionism", "neoclassicism"]
UK = {"United Kingdom", "United Kingdom of Great Britain and Ireland"}


def fix_text(value):
    """Repair accents the dataset stores as Mac Roman mojibake (e.g. 'G√≥recki' -> 'Górecki')."""
    if not isinstance(value, str) or "√" not in value:
        return value
    try:
        return value.encode("mac_roman").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return value


def rows(workbook, name):
    sheet = workbook[name].iter_rows(values_only=True)
    header = next(sheet)
    return [dict(zip(header, row)) for row in sheet]


workbook = openpyxl.load_workbook(SOURCE, read_only=True)
castaways, discs, spotify = rows(workbook, "castaways"), rows(workbook, "discs"), rows(workbook, "spotify_data")

genres = {}
for row in spotify:
    try:
        genres[(row.get("artist") or "").strip().lower()] = ast.literal_eval(row.get("genres_artist") or "[]")
    except (ValueError, SyntaxError):
        pass


def is_classical(artist):
    return any(word in " ".join(genres.get(artist.lower(), [])) for word in CLASSICAL)


picks = defaultdict(list)
for disc in discs:
    track = disc.get("track_name") or ""
    artist = fix_text(track.rsplit(" by ", 1)[1].strip()) if " by " in track else None
    if artist and artist != "NA" and disc.get("castaway_ref") is not None:
        picks[disc["castaway_ref"]].append(artist)

eligible = []
for person in castaways:
    born = str(person.get("date_of_birth") or "")[:4]
    country = fix_text(person.get("country_of_birth") or "")
    if not born.isdigit() or not 1920 <= int(born) <= 1965 or not country or country == "Roman Empire":
        continue
    artists = list(dict.fromkeys(a for a in picks.get(person["castaway_ref"], []) if not is_classical(a)))
    if len(artists) >= 5:
        eligible.append({"born": int(born), "country": country, "place": fix_text(person.get("place_of_birth") or ""), "artists": artists})

rng = random.Random(7)
uk = [p for p in eligible if p["country"] in UK]
abroad = [p for p in eligible if p["country"] not in UK]
rng.shuffle(uk)
# Spread the non-UK half across as many countries as possible.
by_country = defaultdict(list)
for person in abroad:
    by_country[person["country"]].append(person)
countries = sorted(by_country, key=lambda c: rng.random())
spread = []
while len(spread) < PER_GROUP and any(by_country.values()):
    for country in countries:
        if by_country[country] and len(spread) < PER_GROUP:
            spread.append(by_country[country].pop(rng.randrange(len(by_country[country]))))

sample = [{"id": f"p{index:02d}", **person} for index, person in enumerate(uk[:PER_GROUP] + spread)]
json.dump({"source": "Desert Island Disks (Finnegan et al., 2021), CC BY-NC-SA 4.0", "eligible": len(eligible), "people": sample}, open(OUT, "w"), indent=1, ensure_ascii=False)
print(f"eligible {len(eligible)}; sampled {len(sample)}; countries: {sorted({p['country'] for p in sample})}")
