# AISBench Platform

AISBench Platform 是独立于 AISBench 执行引擎的本地 EvalOps 控制面。它面向 GPU → 昇腾 NPU 迁移、性能调优和复杂 Agent 评测，提供可复现、可对比、可定位、可重跑的单机 Web 工作流。

## 演示模式（推荐）

双击 `start-demo.cmd`，或在仓库根目录执行 `python demo.py`。演示模式使用完整模拟数据，不连接 AISBench，不需要安装项目或第三方依赖，并会自动打开浏览器。

## 开发模式

```bash
python -m aisbench_platform.server
```

开发环境未安装包时：

```bash
set PYTHONPATH=src
python -m aisbench_platform.server
```

默认打开 `http://127.0.0.1:8000`，数据保存在 `~/.aisbench-platform`。完整设计见 [docs/design.md](docs/design.md)，使用说明见 [docs/quickstart.md](docs/quickstart.md)。
