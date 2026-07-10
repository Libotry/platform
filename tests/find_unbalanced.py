"""Locate unmatched brackets in app.js, ignoring string/template-literal/line-comment
content."""
import re, pathlib

src = pathlib.Path(r"src\aisbench_platform\static\app.js").read_text(encoding="utf-8")

# Strip line comments (// ...) — app.js has none, but be safe
src = re.sub(r"//[^\n]*", "", src)
# Strip block comments
src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
# Strip string literals ' " ` (non-greedy, no escape support — fine for this file)
src = re.sub(r"'(?:\\.|[^'\\])*'", "''", src)
src = re.sub(r'"(?:\\.|[^"\\])*"', '""', src)
src = re.sub(r"`(?:\\.|[^`\\])*`", "``", src)

opens = [("[", "]"), ("(", ")"), ("{", "}")]
for o, c in opens:
    diff = src.count(o) - src.count(c)
    print(f"{o}{c}:  {src.count(o)} opens / {src.count(c)} closes  diff={diff}")

# Find the first line whose running depth fails
for o, c in opens:
    depth = 0
    for i, ch in enumerate(src):
        if ch == o:
            depth += 1
        elif ch == c:
            depth -= 1
            if depth < 0:
                # show 60 chars around i
                line_no = src[:i].count("\n") + 1
                print(f"\nfirst over-close for {o}{c} at char {i} (line ~{line_no}):")
                print(repr(src[max(0, i - 80): i + 80]))
                break