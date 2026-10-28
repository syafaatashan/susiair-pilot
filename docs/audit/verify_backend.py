#!/usr/bin/env python3
"""Independent recomputation of the Susi Air backend numbers.

Deliberately does NOT reuse any TypeScript logic: rolling windows are recomputed
from mock-flight-hours.json with plain Python date arithmetic (datetime.date),
which has no timezone bug of its own.

Usage:  python docs/audit/verify_backend.py [base_url]
Requires the backend running (default http://127.0.0.1:3010).

Note: the live-DB checks compare against whatever `today` the running instance
uses. Start it with APP_TODAY=2026-05-15 to reproduce the brief's reading for
/documents; without it the code uses the documents dataset's own `today`
(2026-05-31) and the documents check below is expected to fail by design.
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

# ------------------------------------------------------- guard coverage matrix
PROTECTED = ["/pilot/me", "/flight-hours?from=2026-05-01&to=2026-05-02",
             "/flight-hours/summary", "/documents", "/schedules?year=2026&month=5"]
for path in PROTECTED:
    s0, _ = http(path)
    s1, _ = http(path, token)
    s2, _ = http(path, "not.a.jwt")
    check(f"guard {path}: no-token 401 / malformed-token 401 / valid-token 200",
          (s0, s2, s1) == (401, 401, 200), f"got {s0}/{s2}/{s1}")
s_bad, body_bad = http("/auth/login", method="POST", body={"username": "johndoe", "password": "wrong"})
check("POST /auth/login wrong password -> 401 Invalid credentials", s_bad == 401 and body_bad.get("message") == "Invalid credentials", f"http={s_bad} {body_bad.get('message')}")
s_public, _ = http("/auth/login", method="POST", body={"username": "johndoe", "password": "susiairtest"})
check("POST /auth/login is reachable without a token", s_public == 200, f"http={s_public}")

# ------------------------------------------------- consistent error shape
ERR_KEYS = {"statusCode", "message", "error", "timestamp", "path"}
SHAPE_CASES = [
    ("400 bad from/to", "/flight-hours?from=abc&to=zzz", None, 400),
    ("400 missing params", "/flight-hours", None, 400),
    ("400 bad range", "/flight-hours/summary?range=2w", None, 400),
    ("400 month out of range", "/schedules?year=2026&month=13", None, 400),
    ("400 month missing", "/schedules?year=2026", None, 400),
    ("401 no token", "/documents", None, 401),
    ("404 unknown route", "/does-not-exist", None, 404),
]
for label, path, _unused, expect in SHAPE_CASES:
    s, b = http(path, None if expect == 401 else token)
    ok = s == expect and isinstance(b, dict) and set(b) == ERR_KEYS and isinstance(b.get("error"), str) and isinstance(b.get("path"), str)
    check(f"error shape {label}", ok, f"http={s} keys={sorted(b) if isinstance(b, dict) else b}")

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
check("future dates beyond dataset end still return a value (display range may exceed dataset)",
      all("value" in pt and isinstance(pt["value"], (int, float)) for pt in future),
      f"n_future={len(future)} latest_dataset={FH['flightHours'][-1]['date']}")
check("last chart point (today+7d) carries a value even though the window looks forward",
      w["chartData"][-1]["value"] == rolling_map(7)[w["chartData"][-1]["date"]],
      f"{w['chartData'][-1]}")
# 1y window at `today` reaches back 365d; dataset starts 2024-12-27 so no pre-dataset days in this sample
pre_start = iso(d(TODAY) - timedelta(days=364)) < FH["flightHours"][0]["date"]
check("1y window before-earliest handling verified at the earliest date",
      http(f"/flight-hours?from={FH['flightHours'][0]['date']}&to={FH['flightHours'][0]['date']}", token)[1]
      == [{"date": FH["flightHours"][0]["date"], "hours": HOURS[FH["flightHours"][0]["date"]]}],
      f"1y window used by the API does reach before 2024-12-27: {pre_start} (window start {iso(d(TODAY) - timedelta(days=364))})")
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

# timezone sensitivity of DocumentsService.daysBetween (local-time Date + Math.ceil)
import os, subprocess
ENV_JS = (
    "const f=s=>new Date(s+'T00:00:00');"
    "const d=(a,b)=>Math.ceil((f(b).getTime()-f(a).getTime())/864e5);"
    "console.log(d('2026-05-31','2026-10-14'),d('2026-05-31','2026-12-25'),d('2026-05-31','2026-05-29'),d('2026-05-31','2026-06-11'),d('2026-05-31','2026-05-01'))"
)
for tz in ("Asia/Makassar", "America/New_York"):
    env = dict(os.environ, TZ=tz)
    out = subprocess.run(["node", "-e", ENV_JS], capture_output=True, text=True, env=env).stdout.strip()
    print(f"PROBE  docs maths under TZ={tz:<18} {out}   <-- expected 136 208 -2 11 -30")
check("documents daysRemaining is timezone-independent",
      subprocess.run(["node", "-e", ENV_JS], capture_output=True, text=True,
                     env=dict(os.environ, TZ="America/New_York")).stdout.split()
      == subprocess.run(["node", "-e", ENV_JS], capture_output=True, text=True,
                        env=dict(os.environ, TZ="Asia/Makassar")).stdout.split())

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

# ------------------------------------------------- known-defect probes (reported, not asserted as PASS)
print("-" * 78)
s_rev, b_rev = http("/flight-hours?from=2026-05-10&to=2026-05-01", token)
print(f"PROBE  from>to returns http={s_rev} body={b_rev}  <-- inverted range not rejected by DTO")
s_norm, b_norm = http("/flight-hours?from=2026-02-30&to=2026-03-02", token)
print(f"PROBE  impossible calendar date 2026-02-30 -> http={s_norm} body={b_norm}  <-- IsDateString normalises it")
s_big, _ = http("/flight-hours?from=2024-12-27&to=2025-12-27", token)
print(f"PROBE  1-year range -> http={s_big}, {len(_) if isinstance(_, list) else '?'} rows (no range cap on /flight-hours)")

print("=" * 78)
print("FAILURES:", fails if fails else "none")
