"""
Geocode care_centers.care_addr -> lat/lng and store in new columns.
- Adds lat/lng columns if missing.
- Uses OpenStreetMap Nominatim (no API key); be gentle with rate limits.
"""
import os
import time
import psycopg2
import requests
import re

PG_DSN = os.getenv(
    "PG_DSN", "host=localhost port=5432 dbname=cogdb user=postgres password=6575"
)
USER_AGENT = os.getenv("GEOCODE_UA", "cog-geocoder/1.0")
SLEEP_SEC = float(os.getenv("GEOCODE_SLEEP", "1.2"))  # Nominatim polite delay


def ensure_columns(conn):
    with conn.cursor() as cur:
        cur.execute("ALTER TABLE care_centers ADD COLUMN IF NOT EXISTS lat double precision;")
        cur.execute("ALTER TABLE care_centers ADD COLUMN IF NOT EXISTS lng double precision;")
    conn.commit()


def fetch_targets(conn, limit=200):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT care_reg_no, care_addr
            FROM care_centers
            WHERE (lat IS NULL OR lng IS NULL)
              AND care_addr IS NOT NULL
              AND care_addr <> ''
            ORDER BY care_reg_no
            LIMIT %s
            """,
            (limit,),
        )
        return cur.fetchall()


def geocode(addr: str):
    def query(q: str):
        url = "https://nominatim.openstreetmap.org/search"
        params = {"q": q, "format": "json", "limit": 1}
        headers = {"User-Agent": USER_AGENT}
        r = requests.get(url, params=params, headers=headers, timeout=10)
        if r.status_code != 200:
            return None
        data = r.json()
        if not data:
            return None
        return float(data[0]["lat"]), float(data[0]["lon"])

    def normalize(q: str) -> str:
        q = q.strip()
        # remove bracketed info like (남면)
        q = re.sub(r"\s*\([^)]*\)", "", q)
        # remove floor info like '1층', '2층'
        q = re.sub(r"\s*\d+\s*층.*", "", q)
        # keep 앞쪽 행정구역만 남기기 (시/군/구/읍/면/리/길 앞부분)
        parts = q.split()
        if len(parts) >= 3:
            q = " ".join(parts[:3])
        return q.strip()
    def short(q: str, k: int) -> str:
        parts = q.split()
        return " ".join(parts[:k]).strip()

    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": addr, "format": "json", "limit": 1}
    headers = {"User-Agent": USER_AGENT}
    try:
        # 1) raw address
        res = query(addr)
        if res:
            return res
        # 2) add country prefix
        res = query(f"대한민국 {addr}")
        if res:
            return res
        # 3) normalized (remove brackets) + country
        norm = normalize(addr)
        if norm:
            res = query(f"대한민국 {norm}")
            if res:
                return res
            # 4) shorter variants: first 2~3 tokens with country
            if len(norm.split()) >= 2:
                res = query(f"대한민국 {short(norm,2)}")
                if res:
                    return res
            if len(norm.split()) >= 3:
                res = query(f"대한민국 {short(norm,3)}")
                if res:
                    return res
        return None
    except Exception:
        return None


def save_coords(conn, rows):
    if not rows:
        return 0
    with conn.cursor() as cur:
        cur.executemany(
            "UPDATE care_centers SET lat=%s, lng=%s WHERE care_reg_no=%s",
            rows,
        )
    conn.commit()
    return len(rows)


def main():
    conn = psycopg2.connect(PG_DSN)
    try:
        ensure_columns(conn)
        while True:
            targets = fetch_targets(conn, limit=50)
            if not targets:
                print("All rows have lat/lng. Done.")
                break
            to_save = []
            for care_reg_no, addr in targets:
                coords = geocode(addr)
                if coords:
                    to_save.append((coords[0], coords[1], care_reg_no))
                    print(f"[OK] {care_reg_no} -> {coords}")
                else:
                    print(f"[MISS] {care_reg_no} addr='{addr}'")
                time.sleep(SLEEP_SEC)
            if to_save:
                cnt = save_coords(conn, to_save)
                print(f"Updated {cnt} rows.")
            else:
                # nothing saved in this batch; break to avoid infinite loop
                break
    finally:
        conn.close()


if __name__ == "__main__":
    main()
