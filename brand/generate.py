"""Generate the Skint brand assets.

Writes the SVGs, PNGs, favicon, Open Graph image and preview sheet into brand/, src/app/ and
public/icons/. Font outlines are baked into the SVG paths, so the output needs no fonts installed.

Needs: python3 with fontTools, uharfbuzz, brotli and Pillow (pip install fonttools uharfbuzz brotli
pillow), a Chromium binary (set $CHROME, or have chromium / google-chrome on the PATH) and network
access the first time, to fetch Instrument Sans and IBM Plex Mono from Google Fonts into brand/.fonts.

    python3 brand/generate.py
"""
import glob, json, os, re, shutil, subprocess, sys, urllib.request
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.recordingPen import DecomposingRecordingPen, RecordingPen
from fontTools.varLib import instancer
import uharfbuzz as hb
from PIL import Image

BRAND = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(BRAND)
FONTS = os.path.join(BRAND, ".fonts")
APP = os.path.join(REPO, "src", "app")
ICONS = os.path.join(REPO, "public", "icons")
RENDER = os.path.join(FONTS, "render")
for d in (FONTS, ICONS, RENDER):
    os.makedirs(d, exist_ok=True)

INK, PAPER, CANVAS, COBALT, BRASS = "#16181d", "#f5f3ee", "#e7e4dd", "#2451b3", "#e0ad3a"
INK_DARK_BG = "#121315"


def find_chrome():
    cands = [os.environ.get("CHROME")] + [shutil.which(n) for n in ("chromium", "chromium-browser", "google-chrome", "chrome")]
    cands += sorted(glob.glob("/opt/pw-browsers/chromium-*/chrome-linux/chrome"), reverse=True)
    cands += ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
    for c in cands:
        if c and os.path.exists(c):
            return c
    sys.exit("No Chromium found. Set $CHROME to a Chrome or Chromium binary.")


CHROME = find_chrome()

# ---------- fonts ------------------------------------------------------------------------------
# Google Fonts serves per-script woff2 subsets; we want the latin one for each weight.
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"


def fetch(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA})).read()


def ensure_fonts():
    wanted = {"InstrumentSans-600.ttf", "InstrumentSans-500.ttf", "InstrumentSans-700.ttf", "IBMPlexMono-500.ttf", "IBMPlexMono-600.ttf"}
    if wanted <= set(os.listdir(FONTS)):
        return
    print("fetching fonts from Google Fonts into brand/.fonts")
    jobs = [("Instrument+Sans:wght@400..700", "InstrumentSans"), ("IBM+Plex+Mono:wght@500;600", "IBMPlexMono")]
    for fam, name in jobs:
        css = fetch(f"https://fonts.googleapis.com/css2?family={fam}&display=swap").decode()
        for part in css.split("/* latin */")[1:]:
            face = part.split("}")[0]
            weight = re.search(r"font-weight:\s*([^;]+);", face).group(1).strip().replace(" ", "_")
            url = re.search(r"url\(([^)]+)\)", face).group(1)
            woff = os.path.join(FONTS, f"{name}-{weight}.woff2")
            open(woff, "wb").write(fetch(url))
            f = TTFont(woff)
            f.flavor = None
            f.save(woff.replace(".woff2", ".ttf"))
    vf = os.path.join(FONTS, "InstrumentSans-400_700.ttf")
    for w in (500, 600, 700):
        instancer.instantiateVariableFont(TTFont(vf), {"wght": w}).save(os.path.join(FONTS, f"InstrumentSans-{w}.ttf"))


ensure_fonts()

# ---------- type -------------------------------------------------------------------------

SANS = os.path.join(FONTS, "InstrumentSans-600.ttf")
font = TTFont(SANS)
gs = font.getGlyphSet()
XH = font["OS/2"].sxHeight  # 510


def shape(text, path=SANS, tracking=0):
    blob = hb.Blob(open(path, "rb").read())
    hbfont = hb.Font(hb.Face(blob))
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hbfont, buf, {"kern": True, "liga": True})
    out, x = [], 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        out.append((font.getGlyphName(info.codepoint), x + pos.x_offset))
        x += pos.x_advance + tracking
    return out, x - tracking


def glyph_contours(gname):
    rec = DecomposingRecordingPen(gs)
    gs[gname].draw(rec)
    contours, cur = [], []
    for op, args in rec.value:
        cur.append((op, args))
        if op in ("closePath", "endPath"):
            contours.append(cur)
            cur = []
    return contours


def contour_bounds(c):
    pts = [p for op, args in c for p in args if isinstance(p, tuple)]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def contours_to_d(contours, dx, dy, k):
    rec = RecordingPen()
    for c in contours:
        rec.value.extend(c)
    svg = SVGPathPen(gs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
    rec.replay(TransformPen(svg, (k, 0, 0, -k, dx, dy)))
    return svg.getCommands()


K = 0.1  # font units -> wordmark units (1000 upm -> 100)
TRACK = -18  # font units per gap, close to the app's -0.025em headline tracking


def build_wordmark():
    glyphs, adv = shape("skint", tracking=TRACK)
    ink_parts, coin = [], None
    xmin, xmax, ymin, ymax = 1e9, -1e9, 1e9, -1e9
    for gname, x in glyphs:
        contours = glyph_contours(gname)
        if gname == "i":
            dot = [c for c in contours if contour_bounds(c)[1] > XH]
            contours = [c for c in contours if contour_bounds(c)[1] <= XH]
            dx0, dy0, dx1, dy1 = contour_bounds(dot[0])
            w = dx1 - dx0
            r = w * 0.58  # a touch bigger than the font's tittle so it reads as a coin
            cx = (dx0 + dx1) / 2
            cy = dy0 + r  # same clearance above the stem as the original dot
            coin = {"cx": round((x + cx) * K, 2), "cy": round(-cy * K, 2), "r": round(r * K, 2)}
            ymax = max(ymax, cy + r)
        for c in contours:
            bx0, by0, bx1, by1 = contour_bounds(c)
            xmin, xmax = min(xmin, x + bx0), max(xmax, x + bx1)
            ymin, ymax = min(ymin, by0), max(ymax, by1)
        ink_parts.append(contours_to_d(contours, x * K, 0, K))
    d = " ".join(ink_parts)
    box = {"x": round(xmin * K, 2), "y": round(-ymax * K, 2), "w": round((xmax - xmin) * K, 2), "h": round((ymax - ymin) * K, 2)}
    return {"d": d, "coin": coin, "box": box, "k_top": 72.7}


WM = build_wordmark()
print("wordmark box", WM["box"], "coin", WM["coin"])

# ---------- mark ---------------------------------------------------------------------------
# A pill ring with one coin resting at the bottom: the last penny. Designed on a 64 grid,
# the ring occupies x 16..48, y 9..55 (32 x 46), centred on (32, 32).


def stadium(x, y, w, h):
    r = w / 2
    return (
        f"M{x + r} {y} H{x + w - r} A{r} {r} 0 0 1 {x + w} {y + r} V{y + h - r} "
        f"A{r} {r} 0 0 1 {x + w - r} {y + h} H{x + r} A{r} {r} 0 0 1 {x} {y + h - r} "
        f"V{y + r} A{r} {r} 0 0 1 {x + r} {y} Z"
    )


MARK = {"x": 16, "y": 9, "w": 32, "h": 46, "stroke": 7, "coin_r": 5, "coin_gap": 2.5}
m = MARK
inner = (m["x"] + m["stroke"], m["y"] + m["stroke"], m["w"] - 2 * m["stroke"], m["h"] - 2 * m["stroke"])
MARK_D = stadium(m["x"], m["y"], m["w"], m["h"]) + " " + stadium(*inner)
MARK_COIN = {"cx": m["x"] + m["w"] / 2, "cy": inner[1] + inner[3] - m["coin_gap"] - m["coin_r"], "r": m["coin_r"]}
MARK_VB = f'{m["x"]} {m["y"]} {m["w"]} {m["h"]}'  # tight box


def mark_group(ring, coin, transform=""):
    t = f' transform="{transform}"' if transform else ""
    return (
        f'<g{t}><path fill-rule="evenodd" fill="{ring}" d="{MARK_D}"/>'
        f'<circle cx="{MARK_COIN["cx"]}" cy="{MARK_COIN["cy"]}" r="{MARK_COIN["r"]}" fill="{coin}"/></g>'
    )


def mark_svg(ring, coin, height=46):
    w = height * m["w"] / m["h"]
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w:.2f}" height="{height}" viewBox="{MARK_VB}" role="img" aria-label="Skint">'
        + mark_group(ring, coin)
        + "</svg>"
    )


def tile_group(size, x=0, y=0, rounded=True, frac=0.63, bg=COBALT, ring=PAPER, coin=BRASS):
    """Cobalt rounded square with the mark centred in it; the mark's height is `frac` of the tile."""
    rx = round(size * 0.2237, 2) if rounded else 0
    sc = size * frac / m["h"]
    off = size / 2 - 32 * sc
    return (
        f'<rect x="{x}" y="{y}" width="{size}" height="{size}" rx="{rx}" fill="{bg}"/>'
        + mark_group(ring, coin, f"translate({x + off:.3f} {y + off:.3f}) scale({sc:.4f})")
    )


def app_icon_svg(size=512, rounded=True, frac=0.63):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">'
        + tile_group(size, rounded=rounded, frac=frac)
        + "</svg>"
    )


def wordmark_svg(ink, coin, height=None):
    b, c = WM["box"], WM["coin"]
    pad = 2
    vb = (b["x"] - pad, b["y"] - pad, b["w"] + 2 * pad, b["h"] + 2 * pad)
    hh = height or vb[3]
    ww = hh * vb[2] / vb[3]
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{ww:.2f}" height="{hh:.2f}" viewBox="{vb[0]:.2f} {vb[1]:.2f} {vb[2]:.2f} {vb[3]:.2f}" role="img" aria-label="Skint">'
        f'<path fill="{ink}" d="{WM["d"]}"/>'
        f'<circle cx="{c["cx"]}" cy="{c["cy"]}" r="{c["r"]}" fill="{coin}"/>'
        f"</svg>"
    )


# Lockup: app tile on the left, wordmark on the right. Tile is a little taller than the
# ascender and centred on the ascender's midpoint, so it reads as an icon rather than a letter.
TILE = 82.0
TILE_Y = -WM["k_top"] / 2 - TILE / 2
GAP = 20.0
LK = {"tile": TILE, "tile_y": round(TILE_Y, 2), "wm_dx": round(TILE + GAP - WM["box"]["x"], 2)}
LK["w"] = round(TILE + GAP + WM["box"]["w"], 2)
LK["top"] = round(min(TILE_Y, WM["box"]["y"]), 2)
LK["bottom"] = round(max(TILE_Y + TILE, WM["box"]["y"] + WM["box"]["h"]), 2)
print("lockup", LK)


def lockup_svg(ink, coin, height=None):
    c = WM["coin"]
    pad = 2
    vb = (-pad, LK["top"] - pad, LK["w"] + 2 * pad, LK["bottom"] - LK["top"] + 2 * pad)
    hh = height or vb[3]
    ww = hh * vb[2] / vb[3]
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{ww:.2f}" height="{hh:.2f}" viewBox="{vb[0]:.2f} {vb[1]:.2f} {vb[2]:.2f} {vb[3]:.2f}" role="img" aria-label="Skint">'
        + tile_group(TILE, 0, LK["tile_y"])
        + f'<g transform="translate({LK["wm_dx"]} 0)"><path fill="{ink}" d="{WM["d"]}"/>'
        f'<circle cx="{c["cx"]}" cy="{c["cy"]}" r="{c["r"]}" fill="{coin}"/></g>'
        f"</svg>"
    )


def write(path, text):
    with open(path, "w") as f:
        f.write(text if text.endswith("\n") else text + "\n")


# ---------- SVG files ------------------------------------------------------------------------
write(os.path.join(BRAND, "skint-mark.svg"), mark_svg(INK, BRASS, height=96))
write(os.path.join(BRAND, "skint-mark-paper.svg"), mark_svg(PAPER, BRASS, height=96))
write(os.path.join(BRAND, "skint-mark-mono.svg"), mark_svg("currentColor", "currentColor", height=96))
write(os.path.join(BRAND, "skint-wordmark.svg"), wordmark_svg(INK, BRASS))
write(os.path.join(BRAND, "skint-wordmark-paper.svg"), wordmark_svg(PAPER, BRASS))
write(os.path.join(BRAND, "skint-lockup.svg"), lockup_svg(INK, BRASS))
write(os.path.join(BRAND, "skint-lockup-paper.svg"), lockup_svg(PAPER, BRASS))
write(os.path.join(BRAND, "skint-app-icon.svg"), app_icon_svg())
# Favicon: Next.js serves src/app/icon.svg automatically. Slightly bigger mark for tiny sizes.
write(os.path.join(APP, "icon.svg"), app_icon_svg(size=64, frac=0.7))

# Numbers the React component (src/components/Logo.tsx) is built from.
json.dump(
    {"mark": {"d": MARK_D, "coin": MARK_COIN, "viewBox": MARK_VB, "box": MARK}, "wordmark": WM, "lockup": LK},
    open(os.path.join(FONTS, "geometry.json"), "w"),
    indent=1,
)


# ---------- rasterise with headless Chromium ---------------------------------------------------
def render(html_path, png_path, w, h, scale=1):
    """Screenshot a local page at w x h CSS px. Headless Chromium's viewport comes out about 90px
    shorter than --window-size, so ask for more and crop to the top-left w x h."""
    cmd = [
        CHROME, "--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
        f"--window-size={w},{h + 120}", f"--force-device-scale-factor={scale}",
        "--default-background-color=00000000", f"--screenshot={png_path}", f"file://{html_path}",
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    im = Image.open(png_path)
    im.crop((0, 0, int(w * scale), int(h * scale))).save(png_path)


def render_svg(svg_text, png_path, w, h):
    hp = os.path.join(RENDER, os.path.basename(png_path) + ".html")
    svg = svg_text.replace("<svg ", f'<svg style="width:{w}px;height:{h}px;display:block" ', 1)
    write(hp, f'<!doctype html><html><body style="margin:0;background:transparent">{svg}</body></html>')
    render(hp, png_path, w, h)


render_svg(app_icon_svg(rounded=False), os.path.join(APP, "apple-icon.png"), 180, 180)
render_svg(app_icon_svg(), os.path.join(ICONS, "icon-192.png"), 192, 192)
render_svg(app_icon_svg(), os.path.join(ICONS, "icon-512.png"), 512, 512)
render_svg(app_icon_svg(rounded=False, frac=0.5), os.path.join(ICONS, "icon-512-maskable.png"), 512, 512)
for s in (16, 32, 48):
    render_svg(app_icon_svg(frac=0.7), os.path.join(RENDER, f"fav-{s}.png"), s, s)
subprocess.run(["convert"] + [os.path.join(RENDER, f"fav-{s}.png") for s in (16, 32, 48)] + [os.path.join(APP, "favicon.ico")], check=True)
render_svg(app_icon_svg(), os.path.join(BRAND, "skint-app-icon.png"), 1024, 1024)

FONT_CSS = f"""
@font-face {{ font-family: IS; src: url(file://{FONTS}/InstrumentSans-500.ttf); font-weight: 500; }}
@font-face {{ font-family: IS; src: url(file://{FONTS}/InstrumentSans-600.ttf); font-weight: 600; }}
@font-face {{ font-family: IS; src: url(file://{FONTS}/InstrumentSans-700.ttf); font-weight: 700; }}
@font-face {{ font-family: PM; src: url(file://{FONTS}/IBMPlexMono-500.ttf); font-weight: 500; }}
@font-face {{ font-family: PM; src: url(file://{FONTS}/IBMPlexMono-600.ttf); font-weight: 600; }}
"""

# Open Graph image, 1200x630
og = f"""<!doctype html><html><head><style>{FONT_CSS}
html,body{{margin:0;width:1200px;height:630px;overflow:hidden}}
body{{background:{PAPER};font-family:IS;color:{INK};position:relative}}
.wrap{{position:absolute;left:96px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;width:1008px}}
h1{{margin:44px 0 0;font-size:80px;line-height:1.02;letter-spacing:-0.03em;font-weight:600}}
p{{margin:24px 0 0;font-size:29px;line-height:1.35;color:#4b4f57;font-weight:500;max-width:860px}}
.foot{{position:absolute;left:96px;right:96px;bottom:54px;display:flex;justify-content:space-between;font-family:PM;font-weight:500;font-size:20px;letter-spacing:.08em;text-transform:uppercase;color:#6b6f77}}
.rule{{position:absolute;left:0;right:0;bottom:0;height:14px;background:{COBALT}}}
</style></head><body><div class="wrap">
{lockup_svg(INK, BRASS, height=76)}
<h1>Spend less than your mates.</h1>
<p>A league for friends. Screenshot what you spend, confirm what the AI read, lowest total wins.</p>
</div><div class="foot"><span>Weekly &amp; monthly Wrapped</span><span>Lowest wins</span></div><div class="rule"></div></body></html>"""
ogp = os.path.join(RENDER, "og.html")
write(ogp, og)
render(ogp, os.path.join(APP, "opengraph-image.png"), 1200, 630)


# Brand preview sheet
def swatch(name, hexv, text=INK):
    return f'<div class="sw" style="background:{hexv};color:{text}"><b>{name}</b><span>{hexv}</span></div>'


sheet = f"""<!doctype html><html><head><style>{FONT_CSS}
*{{box-sizing:border-box}}
body{{margin:0;width:1200px;background:{CANVAS};font-family:IS;color:{INK};padding:56px 64px 72px}}
h2{{font-family:PM;font-weight:500;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:#6b6f77;margin:44px 0 14px}}
.row{{display:flex;gap:20px;align-items:stretch}}
.card{{background:{PAPER};border:1px solid #e3e0d8;border-radius:18px;padding:32px;display:flex;align-items:center;justify-content:center;flex:1}}
.card.dark{{background:{INK_DARK_BG};border-color:#2a2c31}}
.card.cobalt{{background:{COBALT}}}
.sw{{flex:1;height:112px;border-radius:14px;padding:14px 16px;display:flex;flex-direction:column;justify-content:space-between;font-size:14px;border:1px solid rgba(0,0,0,.06)}}
.sw span{{font-family:PM;font-size:13px;opacity:.8}}
.type{{background:{PAPER};border:1px solid #e3e0d8;border-radius:18px;padding:32px 36px;flex:1}}
.type .h{{font-size:40px;letter-spacing:-0.025em;font-weight:600;line-height:1.08}}
.type .p{{font-size:17px;color:#4b4f57;margin-top:10px;line-height:1.4}}
.type .m{{font-family:PM;font-size:34px;margin-top:22px;color:{COBALT}}}
.type .e{{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#6b6f77;margin-top:22px}}
.voice{{display:grid;grid-template-columns:1fr 1fr;gap:14px}}
.voice div{{background:{PAPER};border:1px solid #e3e0d8;border-radius:14px;padding:18px 20px;font-size:17px;font-weight:600;letter-spacing:-0.01em}}
.voice small{{display:block;font-weight:500;font-size:13px;color:#6b6f77;margin-top:6px;letter-spacing:0}}
.sizes{{display:flex;align-items:flex-end;gap:22px}}
.sizes div{{display:flex;flex-direction:column;align-items:center;gap:8px;font-family:PM;font-size:12px;color:#6b6f77}}
.title{{display:flex;justify-content:space-between;align-items:baseline}}
.title b{{font-size:22px;letter-spacing:-0.02em}}
.title span{{font-family:PM;font-size:13px;color:#6b6f77}}
</style></head><body>
<div class="title"><b>Skint brand sheet</b><span>v1 · October 2026</span></div>

<h2>Lockup</h2>
<div class="row">
  <div class="card">{lockup_svg(INK, BRASS, height=104)}</div>
  <div class="card dark">{lockup_svg(PAPER, BRASS, height=104)}</div>
</div>

<h2>Mark · wordmark · app icon</h2>
<div class="row">
  <div class="card">{mark_svg(INK, BRASS, height=132)}</div>
  <div class="card" style="flex:2">{wordmark_svg(INK, BRASS, height=118)}</div>
  <div class="card cobalt">{mark_svg(PAPER, BRASS, height=132)}</div>
  <div class="card">{app_icon_svg(150)}</div>
</div>

<h2>Small sizes</h2>
<div class="card" style="justify-content:flex-start;padding:28px 36px"><div class="sizes">
  <div>{app_icon_svg(16, frac=0.7)}16</div><div>{app_icon_svg(24, frac=0.7)}24</div><div>{app_icon_svg(32, frac=0.7)}32</div><div>{app_icon_svg(48)}48</div><div>{app_icon_svg(64)}64</div><div>{app_icon_svg(96)}96</div>
  <div style="margin-left:28px">{mark_svg(INK, BRASS, height=20)}20</div><div>{mark_svg(INK, BRASS, height=32)}32</div><div>{mark_svg(INK, BRASS, height=48)}48</div>
  <div style="margin-left:28px">{lockup_svg(INK, BRASS, height=22)}22</div><div>{lockup_svg(INK, BRASS, height=32)}32</div><div>{lockup_svg(INK, BRASS, height=40)}40</div>
</div></div>

<h2>Colour</h2>
<div class="row">
  {swatch("Ink", INK, PAPER)}{swatch("Paper", PAPER)}{swatch("Canvas", CANVAS)}{swatch("Cobalt", COBALT, PAPER)}{swatch("Brass", BRASS, INK)}
</div>
<div class="row" style="margin-top:14px">
  {swatch("Good", "#1e7a4c", PAPER)}{swatch("Bad", "#b2362a", PAPER)}{swatch("Warn", "#8a5a0b", PAPER)}{swatch("Ink 2", "#4b4f57", PAPER)}{swatch("Muted", "#6b6f77", PAPER)}
</div>

<h2>Type</h2>
<div class="row">
  <div class="type">
    <div class="h">Spend less than your mates.</div>
    <div class="p">Instrument Sans for everything you read. Semibold headlines, tight tracking, sentence case.</div>
    <div class="m">£0.00 · 1st of 6</div>
    <div class="p" style="margin-top:6px">IBM Plex Mono for every number that is money, a rank or a date.</div>
    <div class="e">Eyebrow · small caps over a hairline</div>
  </div>
</div>

<h2>Voice</h2>
<div class="voice">
  <div>Lowest wins.<small>The whole game in two words. This is the strapline.</small></div>
  <div>Nothing logged today.<small>Plain and short. No exclamation marks.</small></div>
  <div>You're 1st of 6. Don't get cocky.<small>Dry, a little cheeky, never cruel.</small></div>
  <div>Your weekly Wrapped is ready.<small>Second person, present tense, sentence case.</small></div>
</div>
</body></html>"""
sp = os.path.join(RENDER, "sheet.html")
write(sp, sheet)
tall = os.path.join(RENDER, "sheet-tall.png")
render(sp, tall, 1200, 2300, scale=1.5)
# Crop to content: find the last row that differs from the canvas colour.
im = Image.open(tall).convert("RGB")
px = im.load()
canvas_rgb = tuple(int(CANVAS[i : i + 2], 16) for i in (1, 3, 5))
last = 0
for y in range(im.height - 1, -1, -1):
    if any(px[x, y] != canvas_rgb for x in range(0, im.width, 6)):
        last = y
        break
im.crop((0, 0, im.width, min(im.height, last + int(72 * 1.5)))).save(os.path.join(BRAND, "preview.png"))

print("done")
