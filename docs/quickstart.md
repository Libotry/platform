# AISBench 本地 EvalOps 控制台（P0）

本地 EvalOps 控制台面向 GPU 到昇腾 NPU 的迁移验证与复杂评测场景，把 AISBench 从一次性命令扩展为可复现、可对比、可重跑的本地工作流。控制台默认只监听 `127.0.0.1`，Run、配置和样本数据保存在用户本机。

## 启动

安装 AISBench 后执行：

```bash
aisbench-platform
```

开发环境也可从仓库根目录执行：

```bash
python -m aisbench_platform.server
```

默认地址为 `http://127.0.0.1:8000`。可使用 `--port` 修改端口，使用 `--data-dir` 指定状态、日志和结果目录，使用 `--no-browser` 禁止自动打开浏览器。

## P0 能力

- Run 管理：创建精度、性能和 Agent 评测任务，保存执行配置与状态。
- AISBench Runner：通过配置路径把任务交给现有 `ais_bench` CLI 执行，日志单独落盘。
- 精度对齐：以 GPU baseline 和 NPU candidate 为中心展示 Score、能力桶和方向变化。
- Case Diff：展示样本级输入、GPU/NPU 输出、正确性和错误标签，并生成重跑任务。
- 性能调优：结构化展示 TTFT、TPOT、吞吐、QPS、P95/P99 和失败率。
- Prefix Cache：围绕数据生成、缓存预热、压测与 `/metrics` 采集组织场景工作流。
- 配置复现：Run 创建时保存配置快照，支持 JSON 导入与导出。

## 架构边界

Web UI 是单机控制面，复用 AISBench 的配置加载、Worker、Runner、Summarizer 和结果目录；它不替代性能 profiler、模型服务管理或缺陷管理系统。P0 使用本地 JSON 状态文件，适合单用户单进程部署。

后续 P1 可在不改变页面信息架构的前提下替换为 SQLite、接入结构化 Collector、补齐真实 Case 结果解析、配置版本管理、多 Run 扫描，以及轻量 Agent/Collector 的多机执行。
