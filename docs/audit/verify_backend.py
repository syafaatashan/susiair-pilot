#!/usr/bin/env python3
"""Independent recomputation of the Susi Air backend numbers.

Deliberately does NOT reuse any TypeScript logic: windows are recomputed from
mock-flight-hours.json with plain Python date arithmetic.

Usage:  python docs/audit/verify_backend.py [base_url]
Requires the backend running (default http://127.0.0.1:3010).
"""
import json
import sys
import urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3010"

FH = json.loads((ROOT / "mock-flight-hours.json").read_text(encoding="utf-8"))
DOCS = json.loads((ROOT / "mock-documents.json").read_text(encoding="utf-8"))
SCHED = json.loads((ROOT / "mock-schedules.json").read_text(encoding="utf-8"))

HOURS = {e["date"]: e["hours"] for e in FH["flightHours"]}
TODAY = SCHED["today"]                      # brief: treat today as 2026-05-15
DOCS_TODAY = DOCS["today"]                  # documents dataset: 2026-05-31 (discrepancy)

BOUNDS = FH["chartBounds"]
DISPLAY_DAYS = 7
RANGES = ("1w", "1m", "3m", "6m", "1y")

fails = []


def http(path, token=None, method="GET", body=None):
    req = urllib.request.Request(BASE + path, method=method)
    if token:
        req.add_header("Authorization", "Bearer " + token)
    if body is not None:
        req.add_header("Content-Type", "application/json")
        req.data = json.dumps(body).encode()
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode() or "null")
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw or "null")
        except json.JSONDecodeError:
            return e.code, raw


def check(name, ok, detail=""):
    print(f"{'PASS' if ok else 'FAIL'}  {name}{'  ' + detail if detail else ''}")
    if not ok:
        fails.append(name)


def d(s):
    y, m, dd = (int(x) for x in s.split("-"))
    return date(y, m, dd)


def iso(dt):
    return dt.isoformat()


# ---------------------------------------------------------------- rolling sums
def rolling_map(window_days):
    """Pure independent rolling sum: window = current day and the window_days-1 days before it."""
    out = {}
    start, end = d(TODAY) - timedelta(days=DISPLAY_DAYS), d(TODAY) + timedelta(days=DISPLAY_DAYS)
    cur = start
    while cur <= end:
        total = 0.0
        for j in range(window_days):
            total += HOURS.get(iso(cur - timedelta(days=j)), 0)
        out[iso(cur)] = round(total, 1)
        cur += timedelta(days=1)
    return out


print("=" * 78)
print("BASE", BASE, "| today(schedules)=", TODAY, "| today(documents)=", DOCS_TODAY)
print("=" * 78)

status, login = http("/auth/login", method="POST", body={"username": "johndoe", "password": "susiairtest"})
check("POST /auth/login 200 + token", status == 200 and bool(login.get("access_token")), f"http={status} keys={sorted(login)}")
token = login["access_token"]
# JWT structure: header.payload.signature, HS256, exp-iat == 2592000
import base64, hashlib, hmac
h, p, sig = token.split(".")
hdr = json.loads(base64.urlsafe_b64decode(h + "=="))
pl = json.loads(base64.urlsafe_b64decode(p + "=="))
expected_sig = base64.urlsafe_b64encode(
    hmac.new(b"susiair-technical-test-secret", f"{h}.{p}".encode(), hashlib.sha256).digest()
).rstrip(b"=").decode()
check("JWT verify (HS256, default secret, sub/username/role, 30d exp)",
      hdr.get("alg") == "HS256" and pl.get("username") == "johndoe" and pl.get("role") == "pilot"
      and pl["exp"] - pl["iat"] == 2592000 and hmac.compare_digest(sig, expected_sig),
      f"alg={hdr.get('alg')} payload={pl}")

for rng in RANGES:
    status, resp = http(f"/flight-hours/summary?range={rng}", token)
    if status != 200:
        check(f"summary {rng} 200", False, f"http={status} {resp}")
        continue
    expected = rolling_map(BOUNDS[rng]["windowDays"])
    api = {pt["date"]: pt["value"] for pt in resp["chartData"]}
    diffs = [f"{k}: api={api.get(k)} py={v}" for k, v in expected.items() if api.get(k) != v]
    check(f"summary {rng}: 15 rolling sums match independent Python recomputation", not diffs, "; ".join(diffs[:6]))
    check(f"summary {rng}: limit={BOUNDS[rng]['limit']} yMax={BOUNDS[rng]['max']}",
          resp["limit"] == BOUNDS[rng]["limit"] and resp["yMax"] == BOUNDS[rng]["max"],
          f"api={resp['limit']}/{resp['yMax']}")
    dates = [pt["date"] for pt in resp["chartData"]]
    check(f"summary {rng}: 15 points, today centered at index 7, -7/+7 span",
          len(dates) == 15 and dates[7] == TODAY
          and dates[0] == iso(d(TODAY) - timedelta(days=7)) and dates[-1] == iso(d(TODAY) + timedelta(days=7)),
          f"n={len(dates)} today_idx={dates.index(TODAY) if TODAY in dates else 'missing'}")
    over = [pt for pt in resp["chartData"] if pt["value"] > resp["limit"]]
    if rng in ("1w", "1m"):
        check(f"summary {rng}: contains values above red limit (must render anyway)", bool(over),
              f"n_over={len(over)} max={max(pt['value'] for pt in resp['chartData'])} limit={resp['limit']}")
    print(f"      {rng}: window={BOUNDS[rng]['windowDays']}d  values={[pt['value'] for pt in resp['chartData']]}")

# future dates outside dataset + window before earliest date
_, w = http("/flight-hours/summary?range=1w", token)
future = [pt for pt in w["chartData"] if pt["date"] > FH["flightHours"][-1]["date"]]
check("future dates beyond dataset end still return a value",
      all("value" in pt and isinstance(pt["value"], (int, float)) for pt in future),
      f"future_points={[(pt['date'], pt['value']) for pt in future]}")
# 1y on 2024-12-27 (earliest) => window extends before earliest date
earliest = FH["flightHours"][0]["date"]
status_e, daily_e = http(f"/flight-hours?from={earliest}&to={earliest}", token)
check("window extending before earliest dataset date is deliberate (lookback past earliest counted as 0)",
      status_e == 200 and daily_e == [{"date": earliest, "hours": HOURS[earliest]}],
      f"http={status_e} {daily_e}")

# zero-hour / missing day fill
status, daily = http(f"/flight-hours?from=2026-05-01&to=2026-05-05", token)
expect = [{"date": iso(d("2026-05-01") + timedelta(days=i)), "hours": HOURS.get(iso(d("2026-05-01") + timedelta(days=i)), 0)} for i in range(5)]
check("GET /flight-hours fills every day with 0 (no skipping)", status == 200 and daily == expect,
      f"api={daily} py={expect}")

# ---------------------------------------------------------------- documents
# recomputed against BOTH candidate "today" values
for ref_name, ref in (("dataset today 2026-05-31", d(DOCS_TODAY)), ("brief today 2026-05-15", d(TODAY))):
    rows = []
    for doc in DOCS["documents"]:
        rem = (d(doc["expiryDate"]) - ref).days
        st = "expired" if rem <= 0 else "soon" if rem <= DOCS["thresholds"]["warningDays"] else "safe"
        rows.append((doc["id"], rem, st))
    print(f"      recomputed vs {ref_name}: {rows}")

status, docs = http("/documents", token)
py31 = {doc["id"]: ((d(doc["expiryDate"]) - d(DOCS_TODAY)).days,
                    "expired" if (d(doc["expiryDate"]) - d(DOCS_TODAY)).days <= 0
                    else "soon" if (d(doc["expiryDate"]) - d(DOCS_TODAY)).days <= DOCS["thresholds"]["warningDays"] else "safe")
          for doc in DOCS["documents"]}
api_docs = {r["id"]: (r["daysRemaining"], r["status"]) for r in docs}
check("GET /documents daysRemaining+status match docs-dataset today 2026-05-31", status == 200 and api_docs == py31,
      f"api={api_docs} py={py31}")
py15 = {doc["id"]: ((d(doc["expiryDate"]) - d(TODAY)).days,
                    "expired" if (d(doc["expiryDate"]) - d(TODAY)).days <= 0
                    else "soon" if (d(doc["expiryDate"]) - d(TODAY)).days <= DOCS["thresholds"]["warningDays"] else "safe")
         for doc in DOCS["documents"]}
print(f"      IF code had used brief today 2026-05-15 it would return: {py15}")

# ---------------------------------------------------------------- schedules
for mm, expected_n in ((4, 17), (5, 21), (6, 16)):
    status, s = http(f"/schedules?year=2026&month={mm:02d}", token)
    got = s.get("schedules", [])
    check(f"GET /schedules 2026-{mm:02d} returns only that month, n={expected_n}",
          status == 200 and len(got) == expected_n and all(e["duty_date"].startswith(f"2026-{mm:02d}") for e in got),
          f"http={status} n={len(got)}")
    check(f"GET /schedules 2026-{mm:02d} today + legend(10)", s.get("today") == TODAY and len(s.get("legend", [])) == 10,
          f"today={s.get('today')} legend={len(s.get('legend', []))}")
status, s = http("/schedules?year=2026&month=07", token)
check("GET /schedules month with no data returns empty list (200)", status == 200 and s.get("schedules") == [], f"http={status} {s.get('schedules')}")

print("=" * 78)
print("FAILURES:", fails if fails else "none")
