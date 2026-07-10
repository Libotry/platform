"""One-command launcher for the AISBench Platform presentation demo."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))
from aisbench_platform.server import main  # noqa: E402

if __name__ == "__main__":
    main(["--data-dir", str(ROOT / ".demo-data")])
