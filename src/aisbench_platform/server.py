import argparse
import json
import os
import shlex
import subprocess
import sys
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from .storage import Store


STATIC_DIR = Path(__file__).with_name("static")


class EvalOpsServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, store):
        super().__init__(address, EvalOpsHandler)
        self.store = store


class EvalOpsHandler(SimpleHTTPRequestHandler):
    server_version = "AISBenchEvalOps/0.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def log_message(self, fmt, *args):
        sys.stderr.write("[ais_bench_ui] " + fmt % args + "\n")

    def _json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length > 1024 * 1024:
            raise ValueError("请求体不能超过 1MB")
        return json.loads(self.rfile.read(length) or b"{}")

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/state":
            return self._json(self.server.store.snapshot())
        if path.startswith("/api/runs/"):
            run = self.server.store.get_run(path.rsplit("/", 1)[-1])
            return self._json(run or {"error": "Run 不存在"}, 200 if run else 404)
        if path == "/api/health":
            return self._json({"ok": True, "service": "AISBench Local EvalOps"})
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            payload = self._body()
            if path == "/api/runs":
                run = self.server.store.create_run(payload)
                if payload.get("execute"):
                    threading.Thread(target=self._execute, args=(run,), daemon=True).start()
                return self._json(run, 201)
            if path.startswith("/api/runs/") and path.endswith("/rerun"):
                source_id = path.split("/")[3]
                source = self.server.store.get_run(source_id)
                if not source:
                    return self._json({"error": "Run 不存在"}, 404)
                new_run = self.server.store.create_run({**source, "name": source["name"] + " · 重跑", "execute": False})
                return self._json(new_run, 201)
            return self._json({"error": "接口不存在"}, 404)
        except (ValueError, json.JSONDecodeError) as exc:
            return self._json({"error": str(exc)}, 400)

    def _execute(self, run):
        config = run.get("config", {})
        command = run.get("command")
        if command:
            args = shlex.split(command, posix=os.name != "nt")
        elif config.get("config_path"):
            args = [sys.executable, "-m", "ais_bench.benchmark.cli.main", config["config_path"], "--mode", config.get("mode", "all")]
        else:
            self.server.store.update_run(run["id"], {"status": "needs_config", "message": "请提供 AISBench config_path 或完整命令"})
            return
        self.server.store.update_run(run["id"], {"status": "running", "progress": 8, "resolved_command": args})
        log_dir = self.server.store.root / "logs"
        log_dir.mkdir(exist_ok=True)
        log_path = log_dir / f"{run['id']}.log"
        try:
            with log_path.open("w", encoding="utf-8", errors="replace") as log:
                result = subprocess.run(args, stdout=log, stderr=subprocess.STDOUT, cwd=str(Path.cwd()), check=False)
            self.server.store.update_run(run["id"], {"status": "completed" if result.returncode == 0 else "failed", "progress": 100, "exit_code": result.returncode, "log_path": str(log_path)})
        except OSError as exc:
            self.server.store.update_run(run["id"], {"status": "failed", "progress": 100, "message": str(exc), "log_path": str(log_path)})


def build_parser():
    parser = argparse.ArgumentParser(description="AISBench 本地 EvalOps Web 控制台")
    parser.add_argument("--host", default="127.0.0.1", help="监听地址，默认仅本机可访问")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--data-dir", default=os.environ.get("AISBENCH_PLATFORM_DATA", "~/.aisbench-platform"))
    parser.add_argument("--no-browser", action="store_true", help="启动后不自动打开浏览器")
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    server = EvalOpsServer((args.host, args.port), Store(args.data_dir))
    url = f"http://{args.host}:{server.server_address[1]}"
    print(f"AISBench Local EvalOps 已启动：{url}")
    print(f"数据目录：{Path(args.data_dir).expanduser().resolve()}")
    if not args.no_browser:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n正在停止 AISBench Local EvalOps…")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
