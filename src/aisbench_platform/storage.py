import json
import os
import threading
import uuid
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path


def utc_now():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


DEMO_RUNS = [
    {
        "id": "run-gpu-baseline",
        "name": "Llama3-8B · GPU 基线",
        "kind": "accuracy",
        "status": "completed",
        "backend": "GPU / vLLM",
        "model": "Llama3-8B-Instruct",
        "dataset": "CEval · 1,342 cases",
        "created_at": "2026-07-09T09:20:00+08:00",
        "duration": "18m 42s",
        "progress": 100,
        "metrics": {"score": 72.8, "pass_rate": 94.1, "failed_cases": 78},
        "config": {"mode": "all", "model": "llama3_8b_vllm", "dataset": "ceval_gen", "workers": 8},
    },
    {
        "id": "run-npu-candidate",
        "name": "Llama3-8B · NPU 候选",
        "kind": "accuracy",
        "status": "completed",
        "backend": "昇腾 NPU / MindIE",
        "model": "Llama3-8B-Instruct",
        "dataset": "CEval · 1,342 cases",
        "created_at": "2026-07-09T14:05:00+08:00",
        "duration": "17m 51s",
        "progress": 100,
        "metrics": {"score": 71.6, "pass_rate": 93.2, "failed_cases": 91},
        "config": {"mode": "all", "model": "llama3_8b_mindie", "dataset": "ceval_gen", "workers": 8},
    },
    {
        "id": "run-prefix-072",
        "name": "Prefix Cache · repeat 72%",
        "kind": "performance",
        "status": "completed",
        "backend": "昇腾 NPU / vLLM",
        "model": "Qwen2.5-72B",
        "dataset": "Prefix workload · 2,000 requests",
        "created_at": "2026-07-10T10:32:00+08:00",
        "duration": "12m 08s",
        "progress": 100,
        "metrics": {"ttft": 186, "tpot": 13.8, "throughput": 3840, "qps": 21.4, "p95": 924, "p99": 1280, "hit_rate": 72.4, "failure_rate": 0.15},
        "config": {"mode": "perf", "scenario": "prefix_cache", "concurrency": 32, "input_len": 4096, "output_len": 256, "repeat_rate": 0.72, "prefix_num": 16, "warmups": 1},
    },
    {
        "id": "run-prefix-046",
        "name": "Prefix Cache · repeat 46%",
        "kind": "performance",
        "status": "completed",
        "backend": "昇腾 NPU / vLLM",
        "model": "Qwen2.5-72B",
        "dataset": "Prefix workload · 2,000 requests",
        "created_at": "2026-07-10T09:03:00+08:00",
        "duration": "12m 44s",
        "progress": 100,
        "metrics": {"ttft": 254, "tpot": 14.1, "throughput": 3310, "qps": 18.7, "p95": 1132, "p99": 1510, "hit_rate": 46.1, "failure_rate": 0.25},
        "config": {"mode": "perf", "scenario": "prefix_cache", "concurrency": 32, "input_len": 4096, "output_len": 256, "repeat_rate": 0.46, "prefix_num": 16, "warmups": 1},
    },
]

DEMO_CASES = [
    {"id": "ceval-0182", "category": "逻辑推理", "question": "若所有 A 都是 B，且部分 B 是 C，以下哪项必然成立？", "baseline": "C", "candidate": "B", "expected": "C", "baseline_ok": True, "candidate_ok": False, "tag": "输出差异"},
    {"id": "ceval-0471", "category": "计算机网络", "question": "TCP 拥塞控制进入快速恢复的触发条件是什么？", "baseline": "3 个重复 ACK", "candidate": "超时重传", "expected": "3 个重复 ACK", "baseline_ok": True, "candidate_ok": False, "tag": "知识偏差"},
    {"id": "ceval-0834", "category": "数学", "question": "函数 f(x)=x²-4x+3 的最小值为？", "baseline": "-1", "candidate": "-1", "expected": "-1", "baseline_ok": True, "candidate_ok": True, "tag": "一致"},
    {"id": "ceval-1106", "category": "操作系统", "question": "页面置换中 Belady 异常可能出现在哪种算法？", "baseline": "LRU", "candidate": "FIFO", "expected": "FIFO", "baseline_ok": False, "candidate_ok": True, "tag": "候选改善"},
]


class Store:
    def __init__(self, data_dir):
        self.root = Path(data_dir).expanduser().resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.path = self.root / "state.json"
        self.lock = threading.RLock()
        if not self.path.exists():
            self._write({"runs": DEMO_RUNS, "cases": DEMO_CASES, "projects": [{"id": "migration", "name": "GPU → 昇腾迁移验证"}]})

    def _read(self):
        with self.path.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def _write(self, data):
        tmp = self.path.with_suffix(".tmp")
        with tmp.open("w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2)
        os.replace(tmp, self.path)

    def snapshot(self):
        with self.lock:
            return deepcopy(self._read())

    def get_run(self, run_id):
        return next((item for item in self.snapshot()["runs"] if item["id"] == run_id), None)

    def create_run(self, payload):
        with self.lock:
            state = self._read()
            config = payload.get("config", {})
            run = {
                "id": "run-" + uuid.uuid4().hex[:10],
                "name": payload.get("name") or f"{payload.get('model', '未命名模型')} · {payload.get('kind', 'accuracy')}",
                "kind": payload.get("kind", "accuracy"),
                "status": "queued",
                "backend": payload.get("backend", "本地 Runner"),
                "model": payload.get("model", config.get("model", "未配置")),
                "dataset": payload.get("dataset", config.get("dataset", "未配置")),
                "created_at": utc_now(),
                "duration": "—",
                "progress": 0,
                "metrics": {},
                "config": config,
                "command": payload.get("command"),
            }
            state["runs"].insert(0, run)
            self._write(state)
            return deepcopy(run)

    def update_run(self, run_id, changes):
        with self.lock:
            state = self._read()
            for run in state["runs"]:
                if run["id"] == run_id:
                    run.update(changes)
                    self._write(state)
                    return deepcopy(run)
        return None
