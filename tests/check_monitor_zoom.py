"""Verify the monitor dashboard exposes Grafana-like time-range zoom,
up to a maximum of 24 hours."""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
JS = (ROOT / "src" / "aisbench_platform" / "static" / "app.js").read_text(
    encoding="utf-8"
)
HTML = (ROOT / "src" / "aisbench_platform" / "static" / "index.html").read_text(
    encoding="utf-8"
)
CSS = (ROOT / "src" / "aisbench_platform" / "static" / "monitor.css").read_text(
    encoding="utf-8"
)


def fail(msg):
    print("FAIL:", msg); sys.exit(1)


# 1) 时间范围选择器必须支持到 24 小时
m = re.search(r'<select[^>]*id="timeRange"[^>]*>(.*?)</select>', JS, re.S)
assert m, "timeRange select missing"
options = re.findall(r'value="(\d+)"', m.group(1))
secs = [int(x) for x in options]
print("time-range options (seconds):", secs)
if 86400 not in secs:
    fail("24h option missing")
if 86400 != max(secs):
    fail("24h must be the max supported range")


# 2) 上下限常量必须存在且 24h 是上限
if "maxSpan = 24 * 3600 * 1000" not in JS:
    fail("maxSpan = 24h constant missing")
if "minSpan = 60 * 1000" not in JS:
    fail("minSpan = 1m constant missing")


# 3) 缩放键 + 重置键都要存在并绑定事件
for btn in ('zoomIn', 'zoomOut', 'zoomReset'):
    if f'id="{btn}"' not in JS:
        fail(f"{btn} button missing")
    if f"document.getElementById('{btn}').onclick" not in JS and f"document.getElementById('{btn}\')" not in JS:
        fail(f"{btn} button not bound")


# 4) 鼠标滚轮 + 拖拽平移必须挂上
if "addEventListener('wheel'" not in JS:
    fail("wheel zoom handler missing")
if "addEventListener('mousedown'" not in JS:
    fail("mousedown pan handler missing")
if "addEventListener('mousemove'" not in JS:
    fail("mousemove pan handler missing")


# 5) X 轴时间标签需要支持跨天显示格式
if "MM-DD HH:mm" not in JS and "MM-DD" not in JS:
    fail("day-aware time format missing")


# 6) 视图窗口切片必须真的传进 drawLiveChart（不能永远画整段）
if "ms.viewStart, ms.viewEnd" not in JS:
    fail("viewStart/viewEnd not threaded into drawLiveChart")
if "(i - vs) * plotW / span" not in JS and "(i - vs) * w / span" not in JS:
    fail("drawLiveChart does not honor view window in line drawing")


# 7) 至少 5 个 span 档位的预设
ranges_block = re.search(r"const TIME_RANGES = \{(.*?)\n\};", JS, re.S).group(1)
keys = re.findall(r"^\s*(\d+)\s*:\s*\{", ranges_block, re.M)
if len(keys) < 5:
    fail(f"TIME_RANGES has {len(keys)} presets, need >= 5")


# 7b) 每档的 points × step 必须等于该档的 spanMs（关键不变量：X 轴实际跨度 = 文案跨度）
#     之前 5m 档 step=1s × 60 点 = 60s ≈ 1 分钟，导致 UI 文案与图严重不符。
for k, body in re.findall(r"(\d+):\s*\{([^}]+)\}", ranges_block):
    points = int(re.search(r"points:\s*(\d+)", body).group(1))
    step_expr = re.search(r"step:\s*([^,]+),", body).group(1).strip()
    span_ms = int(k) * 1000
    actual_ms = points * eval(step_expr)
    if actual_ms != span_ms:
        fail(f"{k}s preset: points({points}) × step({step_expr}) = {actual_ms}ms, expected {span_ms}ms")


# 8) CSS 也要有缩放按钮和画布光标
for sel in ('.zoom-group', '.zoom-btn', 'cursor:grab', 'cursor:grabbing'):
    if sel not in CSS:
        fail(f"css missing: {sel}")


# 9) Y 轴：左侧必须有 leftPad，必须绘制刻度文字，且 nice 化工具函数存在
for needle in (
    "const topPad = 10, bottomPad = 25, leftPad = 44",
    "ctx.fillText(formatY(v), leftPad - 4, y)",
    "function niceFloor",
    "function niceCeil",
    "function formatY",
):
    if needle not in JS:
        fail(f"Y-axis feature missing: {needle}")


# 10) nice 化正确性：niceFloor(v) ≤ v ≤ niceCeil(v) 且结果在 1·2·5×10^n 上
import math
def _nf(v):
    if v == 0: return 0
    sign = -1 if v < 0 else 1
    a = abs(v); exp = math.floor(math.log10(a)); base = 10 ** exp; n = a / base
    step = 1 if n < 2 else (2 if n < 5 else 5)
    return sign * step * base
def _nc(v):
    if v == 0: return 0
    sign = -1 if v < 0 else 1
    a = abs(v); exp = math.floor(math.log10(a)); base = 10 ** exp; n = a / base
    step = 1 if n <= 1 else (2 if n <= 2 else (5 if n <= 5 else 10))
    return sign * step * base
def _is_nice(v):
    if v == 0: return True
    a = abs(v); exp = math.floor(math.log10(a)); base = 10 ** exp; n = a / base
    return n in (1, 2, 5)
for v in (0.9, 1, 1.8, 4.6, 12, 95, 186, 924, 3840, 20000, 84000, 0.05, 0.12):
    lo, hi = _nf(v), _nc(v)
    if not (lo <= v <= hi):
        fail(f"nice({v}): floor={lo} ceil={hi} — {v} not in range")
    if not (_is_nice(lo) and _is_nice(hi)):
        fail(f"nice({v}): floor={lo} ceil={hi} not on 1·2·5×10^n scale")


print("OK · zoom levels:", len(keys), "· range max =", max(int(k) for k in keys), "s")