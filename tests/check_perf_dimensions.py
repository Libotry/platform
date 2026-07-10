"""Verify the perf-compare module ships distinct, self-consistent data for each
of the three scan dimensions and that the dimension select is wired to render.

The file is plain JS, but the relevant facts we need to check are simple
identifier + numeric-array facts that we can read with regex — no full JS
parse needed.
"""
import re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
JS = (ROOT / "src" / "aisbench_platform" / "static" / "perf-compare.js").read_text(
    encoding="utf-8"
)


def arrays_after(label: str) -> list[list[int | float]]:
    """Return every '[a, b, c, ...]' that follows the given identifier in the file."""
    out = []
    pattern = re.compile(rf"\b{re.escape(label)}\s*:\s*\[([^\]]+)\]")
    for m in pattern.finditer(JS):
        nums = [float(x) for x in re.findall(r"-?\d+(?:\.\d+)?", m.group(1))]
        out.append(nums)
    return out


def fail(msg):
    print("FAIL:", msg)
    sys.exit(1)


# 1) 每个维度都有 xAxis（6 个采样点）。
#    perfCurveData 内共有 3 个 xAxis 字段：concurrency/input_len/rps。
x_axes = arrays_after("xAxis")
if len(x_axes) != 3:
    fail(f"expected exactly 3 xAxis arrays, found {len(x_axes)}")
for i, axis in enumerate(x_axes):
    if len(axis) != 6:
        fail(f"xAxis #{i} should have 6 points, got {len(axis)}: {axis}")

# 2) 三个 X 轴必须互不相同 —— 演示上必须能看出来"换了维度"。
if len({tuple(a) for a in x_axes}) != 3:
    fail(f"X axes are not distinct: {x_axes}")

# 3) 每个维度有 3 条 Run × 6 个指标 × 6 个采样点。
#    找每条 Run 的 qps / ttft / tpot / throughput / p95 / p99，共 3 维 × 3 Run × 6 指标 = 54 组数组。
for metric in ("qps", "ttft", "tpot", "throughput", "p95", "p99"):
    arrs = arrays_after(metric)
    if len(arrs) != 9:
        fail(f"{metric}: expected 9 arrays (3 dims × 3 runs), got {len(arrs)}")
    for arr in arrs:
        if len(arr) != 6:
            fail(f"{metric} array length != 6: {arr}")

# 4) 同一条 Run 在不同维度下，QPS 曲线应当显著不同 —— 这是用户期望的"真实切换"。
#    取出所有 qps 数组，按每 3 个一组对应每个维度的三条 Run；只要存在至少 3 条互不相同的曲线即可。
qps = arrays_after("qps")
unique_curves = {tuple(a) for a in qps}
if len(unique_curves) < 3:
    fail(f"QPS curves look identical across runs/dimensions: {qps}")

# 5) select option 三个维度都必须存在并标注 selected 联动。
for opt in ('value="concurrency"', 'value="input_len"', 'value="rps"'):
    if opt not in JS:
        fail(f"select option missing: {opt}")

# 6) 切换维度必须重新渲染（不能再只 toast）。
if "dimSelect.onchange" not in JS:
    fail("curveDimension onchange is not bound")
if "perfDimension = e.target.value" not in JS:
    fail("perfDimension is not updated on change")

# 7) 渲染函数读 perfDimension，不能再写死 concurrency。
for needle in ("const dim = perfCurveData[perfDimension]",
               "const xs = dim.xAxis",
               "dim.workloadNote",
               "dim.insight"):
    if needle not in JS:
        fail(f"render logic missing: {needle}")

print("OK")
print("  xAxis (concurrency / input_len / rps):")
for ax in x_axes:
    print("   ", ax)
print(f"  unique QPS curves: {len(unique_curves)} (>=3 required)")