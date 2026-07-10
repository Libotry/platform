import json

from aisbench_platform.storage import Store


def test_store_bootstraps_and_creates_run(tmp_path):
    store = Store(tmp_path)
    assert len(store.snapshot()["runs"]) >= 4
    run = store.create_run({"name": "test", "kind": "performance", "config": {"mode": "perf"}})
    assert run["status"] == "queued"
    assert store.get_run(run["id"])["name"] == "test"
    assert json.loads((tmp_path / "state.json").read_text(encoding="utf-8"))["runs"][0]["id"] == run["id"]


def test_store_updates_run(tmp_path):
    store = Store(tmp_path)
    run = store.create_run({"name": "test"})
    updated = store.update_run(run["id"], {"status": "completed", "progress": 100})
    assert updated["status"] == "completed"
    assert updated["progress"] == 100
