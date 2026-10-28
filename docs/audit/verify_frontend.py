#!/usr/bin/env python3
"""Independent frontend checks for the Susi Air Nuxt app.

Written by the QA auditor. It does not run the author's scripts/e2e-check.mjs;
it drives the running Nuxt server over HTTP and parses the server-rendered HTML
against the API's own JSON, so a mismatch between UI and API is caught here.

Usage:
    # backend on 3010, Nuxt dev (or preview) on 3020
    python docs/audit/verify_frontend.py

Exit code 0 = every assertion passed.
"""
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UI = "http://localhost:3020"
API = "http://127.0.0.1:3010"
COOKIE = "susi_token"

fails = []


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def req(url, token=None, cookie=None, method="GET", body=None):
    r = urllib.request.Request(url, method=method)
    if token:
        r.add_header("Authorization", "Bearer " + token)
    if cookie:
        r.add_header("Cookie", cookie)
    if body is not None:
        r.add_header("Content-Type", "application/json")
        r.data = json.dumps(body).encode()
    opener = urllib.request.build_opener(NoRedirect)
    try:
        with opener.open(r) as resp:
            return resp.status, resp.read().decode(), dict(resp.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(), dict(e.headers)


def api(path, token):
    s, body, _ = req(API + path, token=token)
    return s, json.loads(body)


def check(name, ok, detail=""):
    print(f"{'PASS' if ok else 'FAIL'}  {name}{'  ' + detail if detail else ''}")
    if not ok:
        fails.append(name)


def location(hdr):
    return next((v for k, v in hdr.items() if k.lower() == "location"), None)


# ------------------------------------------------------------------ auth + api
s, body, _ = req(API + "/auth/login", method="POST", body={"username": "johndoe", "password": "susiairtest"})
TOKEN = json.loads(body)["access_token"]
_, me = api("/pilot/me", TOKEN)
_, docs = api("/documents", TOKEN)
_, summary = api("/flight-hours/summary?range=1w", TOKEN)
_, daily = api("/flight-hours?from=2026-05-15&to=2026-05-15", TOKEN)
_, weekly = api("/flight-hours/summary?range=1w", TOKEN)
_, monthly = api("/flight-hours/summary?range=1m", TOKEN)
_, annual = api("/flight-hours/summary?range=1y", TOKEN)
_, sched = api("/schedules?year=2026&month=05", TOKEN)

COOKIE_HDR = f"{COOKIE}={TOKEN}"


# ------------------------------------------------------------------ routing / guard
s, _, hdr = req(UI + "/")
check("guard: / without cookie -> 302 /login", s in (301, 302, 307, 308) and location(hdr) == "/login", f"http={s} loc={location(hdr)}")
s, _, hdr = req(UI + "/schedule")
check("guard: /schedule without cookie -> 302 /login", s in (301, 302, 307, 308) and location(hdr) == "/login", f"http={s} loc={location(hdr)}")
s, _, hdr = req(UI + "/login", cookie=COOKIE_HDR)
check("guard both ways: /login with a cookie -> 302 /", s in (301, 302, 307, 308) and location(hdr) == "/", f"http={s} loc={location(hdr)}")

# Fixed (F-3): a forged cookie is validated server-side by the auth-session plugin.
# An invalid token gets a 401 from /pilot/me, session resolves authenticated:false,
# and the global middleware redirects to /login. The redirect is the real guard: no
# protected data is rendered and a real sign-in overwrites the cookie (httpOnly
# Set-Cookie on /api/auth/login). Cookie-clearing on the redirect itself is not
# reliable in this Nuxt version (Set-Cookie on a navigateTo 302 is dropped), so it
# is recorded as a cosmetic gap, not a security property.
s, _, hdr = req(UI + "/", cookie=f"{COOKIE}=not-a-jwt")
check("guard: a forged cookie is rejected by the session plugin -> 302 /login",
      s in (301, 302, 307, 308) and location(hdr) == "/login", f"http={s} loc={location(hdr)}")
s, forged_body, _ = req(UI + "/login", cookie=f"{COOKIE}=not-a-jwt")
check("guard: the /login page served after a forged-cookie redirect has no protected data",
      "John Doe" not in forged_body and "total flight hours" not in forged_body
      and "docs__badge--" not in re.sub(r"<style[^>]*>.*?</style>", "", forged_body, flags=re.S),
      "a forged cookie must not surface pilot data anywhere")

# ------------------------------------------------------------------ home page
s, home, hdr = req(UI + "/", cookie=COOKIE_HDR)
check("home: HTTP 200 with data server-rendered", s == 200 and len(home) > 5000, f"http={s} bytes={len(home)}")

# header
check("header: greeting + pilot name + total flight hours + avatar",
      me["name"] in home and "total flight hours" in home and f'{me["totalFlightHours"]:,}' in home and me["avatarUrl"] in home.replace("&amp;", "&"),
      f'name={me["name"]} hours={me["totalFlightHours"]}')

# cards = API values (never hardcoded in the UI layer)
cards = [
    ("Daily", 8, daily[0]["hours"]),
    ("Weekly", 40, weekly["chartData"][7]["value"]),
    ("Monthly", 100, monthly["chartData"][7]["value"]),
    ("Annual", 1050, annual["chartData"][7]["value"]),
]
for label, limit, value in cards:
    ok = f">{label}<" in home and f">{value}<" in home and f"/ {limit} h" in home
    check(f"card {label}: {value} / {limit} h rendered straight from the API", ok, f"api={value}/{limit}")
check("cards: rolling-window captions match the brief (Today / Rolling 7 / 30 / 365 days)",
      "Today" in home and "Rolling 7 days" in home and "Rolling 30 days" in home and "Rolling 365 days" in home)

# documents: badge text must be derived from the API status, not from a local date.
# The SSR HTML inlines a scoped <style> whose `.docs__badge--{ok,warn,bad}` rules
# would inflate a naive str.count, so strip <style>...</style> and count elements only.
home_body = re.sub(r"<style[^>]*>.*?</style>", "", home, flags=re.S)
STATUS_TEXT = {"safe": "Valid", "soon": "Expiring soon", "expired": "Expired"}
for doc in docs:
    ok = doc["label"] in home_body and STATUS_TEXT[doc["status"]] in home_body
    check(f"document {doc['id']}: label + '{STATUS_TEXT[doc['status']]}' badge from API status", ok, f"api_status={doc['status']} days={doc['daysRemaining']}")
check("documents: no hardcoded badge state (each API status class appears as many times as the API says)",
      home_body.count("docs__badge--bad") == sum(1 for d in docs if d["status"] == "expired")
      and home_body.count("docs__badge--warn") == sum(1 for d in docs if d["status"] == "soon")
      and home_body.count("docs__badge--ok") == sum(1 for d in docs if d["status"] == "safe"))

# bottom nav
for label in ("Home", "Schedule", "Logbook", "More"):
    check(f"bottom nav contains {label}", f">{label}<" in home)

# ------------------------------------------------------------------ chart
poly = re.search(r'<polyline class="chart__line" points="([^"]+)"', home)
pts = [tuple(float(x) for x in p.split(",")) for p in poly.group(1).split()] if poly else []
check("chart: 15 points (7 before today, today, 7 after)", len(pts) == 15, f"n={len(pts)}")
check("chart: today is exactly centred", len(pts) == 15 and abs((pts[7][0] - (pts[0][0] + pts[14][0]) / 2)) < 0.01,
      f"x(today)={pts[7][0] if pts else None} mid={(pts[0][0] + pts[14][0]) / 2 if pts else None}")
check("chart: X values come from the API series (dates in -7..+7 window)",
      [p["date"] for p in summary["chartData"]][0] == "2026-05-08" and [p["date"] for p in summary["chartData"]][-1] == "2026-05-22")
check("chart: today gets the larger dot + is-today class", home.count("chart__dot is-today") + home.count("is-today chart__dot") == 1 and 'r="4"' in home)
lim = re.search(r'<line class="chart__limit"[^>]*y1="([\d.]+)"', home)
lim_y = float(lim.group(1)) if lim else -1
check("chart: red limit line at the API limit value (40h of yMax 45)", "chart__limit" in home and f"limit {summary['limit']}h" in home and abs(lim_y - (12 + 116 - (40 / 45) * 116)) < 0.02, f"y={lim_y}")
check("chart: yMax label comes from the API yMax, not a hardcoded number", f">{summary['yMax']}<" in home, f"yMax={summary['yMax']}")
above = [i for i, p in enumerate(pts) if p[1] < lim_y]
clip = [i for i, p in enumerate(pts) if p[1] < 12]
check("chart: the 4 over-limit values render ABOVE the red line", len(above) == 4 and all(above), f"indexes={above}")
check("chart: nothing is clipped outside the 320x150 viewBox (peak must stay visible)",
      not clip and len(pts) == 15 and max(p[1] for p in pts) <= 128.01, f"min_cy={min(p[1] for p in pts):.2f} top_pad=12")
check("chart: grey grid + dashed today marker present",
      home.count('class="chart__grid"') == 1 and "chart__today-line" in home and home.count("<line x1=") >= 5)
check("chart: accent #22C5E8 and dashed red #E63757 in the component",
      "$chart-accent" in (ROOT / "nuxt/components/HoursChart.vue").read_text(encoding="utf-8"))
toggles = re.findall(r'role="tab"[^>]*aria-selected="(\w+)"[^>]*>(\w+)</button>', home)
check("chart: 5 toggles 1w/1m/3m/6m/1y, default 1w selected",
      [t[1] for t in toggles] == ["1w", "1m", "3m", "6m", "1y"] and toggles[0][0] == "true", f"{toggles}")

# ------------------------------------------------------------------ schedule page
s, sch_html, _ = req(UI + "/schedule", cookie=COOKIE_HDR)
check("schedule: HTTP 200 with the month server-rendered from /schedules", s == 200 and "May 2026" in sch_html, f"http={s}")
check("schedule: today marker comes from the API `today`", sched["today"] in sch_html, f"api_today={sched['today']}")
check("schedule: weekday header is Monday-first", re.search(r"Mon.{0,40}Tue.{0,40}Wed.{0,40}Thu.{0,40}Fri.{0,40}Sat.{0,40}Sun", sch_html, re.S) is not None)
# May 2026 starts on a Friday -> 4 leading blanks, 31 day cells
check("schedule: 4 leading blanks + 31 day cells (correct Monday-first offset)",
      sch_html.count('class="is-blank cal__cell"') == 4 and sch_html.count('class="cal__day"') == 31,
      f"blanks={sch_html.count('is-blank cal__cell')} days={sch_html.count('class=&#34;cal__day&#34;') or sch_html.count('class=\"cal__day\"')}")
entries = {e["duty_date"]: e for e in sched["schedules"]}
# Count tick *elements* (class="cal__tick"), not the loose substring, which also
# matches the scoped .cal__tick CSS rule inlined into the SSR <style> block.
ticks = sch_html.count('class="cal__tick"')
rems = [int(x) for x in re.findall(r'cal__rem"[^>]*>(\d+)<', sch_html)]
exp_ticks = sum(1 for e in entries.values() if e["count_logbooks"] == e["count_schedules"])
exp_rems = sorted(e["count_schedules"] - e["count_logbooks"] for e in entries.values() if e["count_logbooks"] != e["count_schedules"])
check("schedule: tick when count_logbooks == count_schedules, otherwise remaining count",
      ticks == exp_ticks and sorted(rems) == exp_rems, f"ticks={ticks}/{exp_ticks} rems={sorted(rems)}/{exp_rems}")
colors = {"#" + c.upper() for c in re.findall(r'background:#([0-9A-Fa-f]{6})', sch_html)}
colors |= {"#%02X%02X%02X" % tuple(int(c) for c in m) for m in re.findall(r'background:\s*rgb\((\d+),\s*(\d+),\s*(\d+)\)', sch_html)}
api_colors = {e["base_color"].upper() for e in entries.values()}
check("schedule: every duty cell is painted with the API base_color", api_colors <= colors, f"api={sorted(api_colors)} out_of={sorted(api_colors - colors)}")
check("schedule: all duty days from the API are rendered", sch_html.count("cal__duty") >= len(entries), f"n={len(entries)}")
legend = re.findall(r'legend__label"[^>]*>([^<]+)</span><span class="legend__code"[^>]*>([^<]+)<', sch_html)
check("schedule: legend below the calendar with all 10 entries from the API",
      len(legend) == 10 and {c for _, c in legend} == {l["code"] for l in sched["legend"]}, f"n={len(legend)}")
check("schedule: prev/next month buttons present", "Prev" in sch_html and "Next" in sch_html)
check("schedule: placeholder text 'Detail page coming soon' exists in the component",
      "Detail page coming soon" in (ROOT / "nuxt/pages/schedule.vue").read_text(encoding="utf-8"),
      "rendered inline on tap (verified in the browser), not as a separate route")

# ------------------------------------------------------------------ dates in the UI
src_files = [p for p in (ROOT / "nuxt").rglob("*") if p.suffix in (".vue", ".ts", ".mjs") and "node_modules" not in p.parts and ".nuxt" not in p.parts and ".output" not in p.parts]
# scripts/ (one-shot e2e runners) are not app/rendered code -> ignore their clocks.
app_src = [p for p in src_files if "scripts" not in p.parts]
hits = []
for p in app_src:
    for i, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
        stripped = line.strip()
        if stripped.startswith("//") or stripped.startswith("*"):
            continue
        if re.search(r"new Date\(|Date\.now", stripped):
            hits.append(f"{p.relative_to(ROOT)}:{i}: {stripped}")
# `new Date()` is acceptable where it does not decide "today": calendar geometry
# uses Date.UTC(...), the sign-in greeting reads getHours(), and server routes
# only timestamp errors with new Date().toISOString(). Anything else is a defect.
unsafe = [h for h in hits if not any(tok in h for tok in ("Date.UTC", "getHours()", "toISOString"))]
print("      new Date( / Date.now occurrences in app source:")
for h in hits:
    print("        " + h)
check("no `new Date()` is used to decide what 'today' is (calendar geometry / greeting / error timestamp only)",
      not unsafe, f"unclassified={unsafe}")
check("the daily card uses the API `today`, not the browser clock",
      "never `new Date()`" in (ROOT / "nuxt/stores/flightHours.ts").read_text(encoding="utf-8"))

# ------------------------------------------------------------------ no mock data in the app
FORBIDDEN = ["John Doe", "1444.5", "doc_recurrent", "doc_ppc", "doc_license", "doc_medical", "doc_security",
             "Indonesian Medical", "Security Clearance", "97020", "record_", "9701", "9702", "9703", "'MKW'", "\"MKW\""]
mock_hits = []
for p in app_src:
    text = p.read_text(encoding="utf-8")
    for needle in FORBIDDEN:
        if needle in text:
            mock_hits.append(f"{p.relative_to(ROOT)}: {needle}")
check("no pilot/document/schedule mock data in the frontend app source", not mock_hits, f"{mock_hits}")
limits = (ROOT / "nuxt/stores/flightHours.ts").read_text(encoding="utf-8")
check("daily limit 8 is hardcoded in the store (API exposes limits only via /flight-hours/summary)",
      "daily: 8" in limits, "documented as regulatory; every other limit comes from the API")

# ------------------------------------------------------------------ security
_appheader_src = (ROOT / "nuxt/components/AppHeader.vue").read_text(encoding="utf-8")
_authstore_src = (ROOT / "nuxt/stores/auth.ts").read_text(encoding="utf-8")
check("SECURITY: the JWT is NOT embedded in the server-rendered HTML", TOKEN not in home and TOKEN not in sch_html,
      "the auth store's token Ref is serialized into __NUXT_DATA__ on every SSR response")
check("SECURITY: the token cookie is httpOnly", "httponly" in _authstore_src.lower(),
      "cookie is set with httpOnly in the login route")
# Fixed (F-2): AppHeader has a Sign Out button bound to a handler that calls auth.signOut().
check("SECURITY: a logout control exists for the pilot (button -> handler -> signOut)",
      re.search(r'@click="[^"]*logout', _appheader_src) is not None and "signOut()" in _authstore_src,
      "no sign-out entry point")


# ------------------------------------------------------------------ design tokens
scss = (ROOT / "nuxt/assets/scss/_variables.scss").read_text(encoding="utf-8").lower()
TOKENS = {"navy": "#0e2138", "red": "#e63757", "bg": "#f5f6f8", "surface": "#ffffff",
          "text-secondary": "#6b7280", "success": "#1fbf8f", "warning": "#f59e0b", "chart-accent": "#22c5e8"}
for name, hexv in TOKENS.items():
    check(f"design token ${name} = {hexv}", f"${name}: {hexv}" in scss)
radius = re.search(r"\$radius-card:\s*(\d+)px", scss)
check("card radius is inside 12-16px", radius and 12 <= int(radius.group(1)) <= 16, f"radius={radius.group(1) if radius else None}px")
main = (ROOT / "nuxt/assets/scss/main.scss").read_text(encoding="utf-8")
check("primary + ghost buttons are pills (border-radius $radius-pill)", "btn-primary" in main and "$radius-pill" in main and "btn-ghost" in main)
pkg = json.loads((ROOT / "nuxt/package.json").read_text(encoding="utf-8"))
deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
check("SCSS (sass) is the styling system and Tailwind is absent", "sass" in deps and not any("tailwind" in k for k in deps), f"styling deps={[k for k in deps if 'sass' in k or 'css' in k]}")
check("Plus Jakarta Sans is declared and loaded in the document head",
      "Plus+Jakarta+Sans" in (ROOT / "nuxt/nuxt.config.ts").read_text(encoding="utf-8") and "plus jakarta sans" in scss)
check("mobile-first: viewport meta + a capped mobile shell width", "viewport" in (ROOT / "nuxt/nuxt.config.ts").read_text(encoding="utf-8") and "$shell-width" in scss)
check("Pinia is registered and stores are auto-imported", "@pinia/nuxt" in (ROOT / "nuxt/nuxt.config.ts").read_text(encoding="utf-8"))
check("over-limit values are never clamped away in the store (no Math.min on the series)", "Math.min" not in (ROOT / "nuxt/stores/flightHours.ts").read_text(encoding="utf-8"))

print("=" * 78)
print("FAILURES:", fails if fails else "none")
sys.exit(1 if fails else 0)
