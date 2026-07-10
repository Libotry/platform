# AISBench Platform 详细设计（P0 初版）

## 1. 文档目的

本文定义 AISBench Platform 的产品目标、系统边界、总体架构、核心流程、数据模型、接口、部署、安全与演进路线。平台代码独立存放在 `Libotry/platform` 仓库；AISBench 保持评测执行引擎定位，两者通过进程与文件协议集成。

## 2. 背景与核心判断

现有 AISBench 擅长通过配置与 CLI 完成精度评测、性能压测和结果汇总，但用户在真实迁移项目中仍需自行补齐批量编排、配置生成、日志解析、基线表格、Case 比对和报告交付。Prefix Cache 外部脚本进一步说明，高频场景已经超出“多适配一个数据集”的范畴。

平台化目标不是增加一个分数看板，而是把一次评测变成可管理的 Run 资产，形成：

`编排 → 执行 → 采集 → 对比 → 定位 → 重跑 → 验收`

## 3. 产品定位与边界

### 3.1 定位

AISBench Platform 是可在客户内网或开发者工作站独立运行的本地 EvalOps 控制面：

- 统一管理项目、模型、环境、配置、Workload、Run、Case 和报告。
- 调用 AISBench、vLLM bench 等执行后端，不重复实现评测算法。
- 把散落的配置、日志、指标和样本输出转成结构化资产。
- 面向 GPU baseline 与 NPU candidate 提供差异定位和迁移验收入口。

### 3.2 P0 范围

- 单用户、单机、单进程 Web 服务。
- 本地项目与 Run 管理。
- AISBench CLI 命令下发、状态跟踪、日志落盘。
- 精度 Score 对比、样本级 Case Diff。
- 性能指标采集与多 Run 表格对比。
- Prefix Cache 场景模板。
- 配置保存、导入、导出与复用。
- 错误 Run 或错误 Case 子集重跑。

### 3.3 明确不做

- 不替代 MindStudio、Nsight 或服务端 profiler。
- 不承担模型服务完整生命周期管理。
- 不替代缺陷管理、代码托管与企业权限系统。
- P0 不做多租户、多机调度和云端协作。
- P0 不在平台内部重新实现 AISBench Dataset、Metric、Judge 和 Runner。

## 4. 用户与关键场景

### 4.1 目标用户

1. 昇腾迁移工程师：判断 GPU/NPU 是否对齐、差在哪里、能否验收。
2. 推理性能工程师：管理并发、长度、RPS、缓存等测试矩阵。
3. 模型/算法工程师：复现历史配置、查看样本退化、沉淀回归集。
4. Agent 评测工程师：追踪环境、任务过程、失败分类和子集重跑。

### 4.2 核心用户故事

- 作为迁移工程师，我选择 GPU Run 为 baseline、NPU Run 为 candidate，立即看到总分、能力桶和 Case 方向变化。
- 作为性能工程师，我配置并发 × 输入长度 × 输出长度 × repeat rate 矩阵，一次生成多个 Run 并对比 TTFT/TPOT/QPS。
- 作为问题定位者，我筛选“GPU 正确、NPU 错误”的 Case，查看输入、输出、Judge、日志和配置，并只重跑这些 Case。
- 作为交付负责人，我导出配置与报告，使验收结果可复现、可审计。

## 5. 信息架构

### 5.1 一级导航

| 页面 | 主要职责 |
|---|---|
| 工作台 | 当前项目健康度、最新 Run、精度差异、性能洞察与待处理问题 |
| Run 管理 | Run 搜索、筛选、创建、停止、重跑、归档和详情 |
| 基线对齐 | baseline/candidate 选择、指标差异、能力桶与验收结论 |
| Case Diff | 样本级输入输出、正确性方向、标签、日志与子集重跑 |
| Workload | 精度、性能、Prefix Cache、长上下文和 Agent 场景模板 |
| 配置中心 | 配置编辑、校验、导入导出、模板与后续版本管理 |
| 报告中心（P1） | 对比报告、交付 PDF、CSV 与验收记录 |

### 5.2 核心对象层级

```text
Project
├── Environment
├── Model Endpoint
├── Config Template
├── Workload
└── Experiment
    ├── Baseline Run
    ├── Candidate Run(s)
    ├── Comparison
    └── Regression Set
        └── Case(s)
```

## 6. 总体架构

```text
Browser
  │ HTTP / JSON / SSE(P1)
  ▼
Platform Web/API ─────────────── Local Store
  │                              SQLite + artifact directory
  ├── Project/Config Service
  ├── Run Orchestrator
  ├── Comparison Service
  ├── Case Service
  └── Report Service
          │
          ▼ process adapter
AISBench Adapter ──► AISBench CLI / other benchmark backends
          │
          ├── stdout/stderr log
          ├── status/progress
          ├── config snapshot
          └── result artifacts
                    │
                    ▼
               Collector
          metric / case / trace / environment
```

### 6.1 分层职责

1. Web UI：任务创建、状态展示、分析交互，不直接访问任意本地文件。
2. API：校验输入、鉴权预留、输出稳定 DTO。
3. Domain Service：项目、Run、Comparison、Case 等领域规则。
4. Orchestrator：状态机、进程生命周期、重试、取消和恢复。
5. Adapter：隔离 AISBench CLI 版本差异，生成命令并解析产物。
6. Collector：将日志与结果文件转为统一结构化记录。
7. Store：元数据与大文件分离；SQLite 存索引，artifact 目录存原始产物。

## 7. 仓库设计

P0 建议逐步演进为以下结构：

```text
platform/
├── pyproject.toml
├── src/aisbench_platform/
│   ├── server.py                 # 进程入口
│   ├── api/                      # HTTP 路由与 DTO
│   ├── domain/                   # Project/Run/Case/Comparison
│   ├── services/                 # 编排与分析服务
│   ├── adapters/aisbench.py      # AISBench CLI 适配器
│   ├── collectors/               # 指标、样本、日志采集
│   ├── persistence/              # SQLite 与 artifact repository
│   └── static/                   # P0 单页 UI
├── tests/
└── docs/
```

当前初版为了保持零第三方依赖，先由 `server.py`、`storage.py` 与 `static/` 组成；进入功能开发后按上述领域边界拆分。

## 8. 核心领域模型

### 8.1 Project

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 项目标识 |
| name | string | 项目名 |
| description | string | 迁移/调优目标 |
| acceptance_policy | JSON | 验收阈值 |
| created_at/updated_at | datetime | 审计时间 |

### 8.2 ConfigRevision

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 配置版本 |
| project_id | UUID | 所属项目 |
| name | string | 配置名称 |
| backend_type | enum | aisbench/vllmbench/custom |
| schema_version | string | 平台配置协议版本 |
| content | JSON/text | 规范化配置与原始配置 |
| checksum | SHA-256 | 复现校验 |
| parent_revision_id | UUID? | 版本来源 |

### 8.3 Run

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | Run 标识 |
| experiment_id | UUID? | 实验归属 |
| config_revision_id | UUID | 不可变配置快照 |
| type | enum | accuracy/performance/agent |
| role | enum | baseline/candidate/standalone |
| status | enum | 状态机状态 |
| command | JSON array | 实际执行 argv，不存 shell 字符串 |
| process_id | int? | 本地进程号 |
| exit_code | int? | 退出码 |
| started_at/finished_at | datetime? | 时间 |
| artifact_dir | path | 受控结果目录 |
| environment_snapshot | JSON | OS、Python、AISBench、后端版本 |

### 8.4 Metric

统一形式：`run_id + scope + name + value + unit + dimensions + timestamp`。

P0 必需指标：

- 精度：score、pass_rate、extract_rate、failed_cases。
- 性能：TTFT、TPOT、E2E、吞吐、QPS/QPM、P50/P95/P99、失败率。
- Prefix Cache：queries、hits、hit_rate、prewarm_duration；P1 增加 DP 域维度。
- Agent：任务成功率、耗时、步骤数、工具调用数、重试数与环境失败数。

### 8.5 CaseResult

| 字段 | 类型 | 说明 |
|---|---|---|
| run_id/case_id | key | 联合标识 |
| dataset/id/category | string | 样本身份与能力桶 |
| input | JSON | 输入快照或受控引用 |
| output | JSON | 模型输出 |
| expected | JSON? | 标准答案 |
| score/correct | number/bool? | 评测结论 |
| judge | JSON? | Judge 结果与理由 |
| latency | JSON? | 样本性能 |
| trace_ref/log_ref | string? | 过程与日志引用 |
| error_type | enum? | model/service/environment/data/judge/unknown |

### 8.6 Comparison

保存 baseline_run_id、candidate_run_ids、匹配键、指标差异、Case 方向变化和验收结论。Comparison 必须引用已完成且可兼容的 Run；模型、数据集或评测协议不一致时，UI 必须明确提示“不可直接比较”。

## 9. Run 状态机

```text
DRAFT → QUEUED → PREPARING → RUNNING → COLLECTING → COMPLETED
                    │          │            │
                    └──────────┴────────────┴──► FAILED
QUEUED/PREPARING/RUNNING ──cancel──► CANCELLING → CANCELLED
FAILED/CANCELLED/COMPLETED ──rerun──► 新 Run（保留 parent_run_id）
```

规则：

- Run 创建后配置快照不可修改；变更配置必须生成新 revision。
- 重跑创建新 Run，禁止覆盖历史 Run。
- 服务重启后检查处于运行态的 PID；PID 不存在则标为 INTERRUPTED，而不是简单 FAILED。
- Collector 失败与 Runner 失败分开记录，允许对已完成的执行重新采集。

## 10. 关键业务流程

### 10.1 创建并执行 Run

1. 用户选择项目、场景模板、模型端点、数据集和参数。
2. 平台进行 schema 校验和后端可用性预检。
3. 保存 ConfigRevision 和 Run。
4. Adapter 将规范化配置转换为 AISBench 配置文件与 argv 数组。
5. Orchestrator 创建受控 artifact 目录并启动子进程。
6. 持续读取状态文件/日志，更新进度。
7. 进程结束后 Collector 解析结果、样本、性能与环境信息。
8. Run 进入 COMPLETED 或 FAILED；页面提示可比较或可重跑动作。

### 10.2 GPU/NPU 对齐

1. 选择 baseline 和 candidate。
2. 校验 dataset revision、metric protocol、case identity 是否匹配。
3. 聚合总分、能力桶和 Case 四象限：都对、都错、基线对候选错、基线错候选对。
4. 根据验收策略计算 pass/warn/fail。
5. 将退化 Case 保存为临时筛选集，可一键生成 Regression Set 与子集 Run。

### 10.3 错误 Case 重跑

1. 用户筛选或勾选 Case。
2. 平台保存不可变 case manifest，记录来源 Comparison。
3. 基于原 Run ConfigRevision 创建派生配置，仅覆盖 sample selection。
4. 创建带 `parent_run_id`、`case_manifest_id` 的新 Run。
5. 重跑结果与原结果并排展示，防止“重跑即覆盖”。

### 10.4 Prefix Cache 场景

1. Workload Builder 接收 input_len、output_len、data_num、长度分布、repeat_rate、prefix_num、concurrency/RPS。
2. Dataset Preparer 生成确定性数据并保存 seed/checksum。
3. 可选 Prewarmer 按 prefix 或 DP 域执行预热。
4. Runner 执行 AISBench perf 或其他后端。
5. Collector 从日志和 `/metrics` 快照计算 queries/hits/hit_rate。
6. 多 Run 对比 repeat_rate、prefix_num、并发与 TTFT/QPS/吞吐关系。

## 11. AISBench 集成设计

### 11.1 集成原则

- Platform 不 import AISBench 内部实现，避免内部 API 强耦合。
- 首选稳定 CLI 与结果文件协议。
- Adapter 负责版本探测、命令生成、产物发现和兼容层。
- 每个 Run 保存 `ais_bench --version`、实际 argv、配置快照和 checksum。

### 11.2 命令执行安全

- API 不接收任意 shell 字符串；服务端构造 argv 数组并以 `shell=False` 执行。
- config、dataset、work_dir 必须解析到用户批准的 workspace 或数据根目录。
- 外部命令路径由管理员配置，不允许请求临时覆盖。
- 日志需过滤 token、Authorization、API Key 与用户配置的敏感字段。

### 11.3 结果协议建议

建议 AISBench 后续提供稳定的 `run-manifest.json`：

```json
{
  "schema_version": "1.0",
  "run_id": "...",
  "status": "completed",
  "config": "configs/resolved.py",
  "metrics": "metrics.jsonl",
  "cases": "cases.jsonl",
  "logs": ["logs/aisbench.log"],
  "artifacts": []
}
```

在该协议提供前，Platform Collector 按 AISBench 版本选择解析器，并保留原始文件以便重新采集。

## 12. HTTP API 设计

统一前缀 `/api/v1`，错误格式为 `{code, message, details, request_id}`。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET/POST | `/projects` | 查询/创建项目 |
| GET/POST | `/configs` | 查询/创建配置版本 |
| POST | `/configs/validate` | 校验配置与后端能力 |
| GET/POST | `/runs` | 查询/创建 Run |
| GET | `/runs/{id}` | Run 详情 |
| POST | `/runs/{id}:cancel` | 取消任务 |
| POST | `/runs/{id}:rerun` | 派生重跑 |
| GET | `/runs/{id}/logs` | 分页读取日志 |
| GET | `/runs/{id}/metrics` | 查询指标 |
| GET | `/runs/{id}/cases` | 筛选 Case |
| POST | `/comparisons` | 创建基线对比 |
| GET | `/comparisons/{id}` | 对比结果 |
| POST | `/case-manifests` | 保存 Case 子集 |
| GET/POST | `/workloads` | Workload 模板 |
| GET | `/events` | P1 SSE 状态事件 |

分页统一使用 cursor；列表筛选不得一次加载全部样本。大输出、trace 和日志返回摘要与受控 artifact 引用。

## 13. 本地存储设计

### 13.1 P0 初版

当前原型使用 `state.json` 和 `logs/`，用于快速验证产品信息架构，不建议承载大规模真实 Case。

### 13.2 P0 正式版

```text
~/.aisbench-platform/
├── platform.db
├── artifacts/{project_id}/{run_id}/
│   ├── config/
│   ├── logs/
│   ├── raw/
│   ├── metrics/
│   └── cases/
├── generated-workloads/
└── backups/
```

- SQLite 使用 WAL；Run、Metric 索引与摘要入库。
- 大型输入输出、trace、图表和原始日志留在 artifact 目录。
- 路径只在 repository 层生成，不接受客户端拼接。
- 删除 Project 默认软删除；artifact 清理必须二次确认并记录审计事件。

## 14. 前端详细设计

### 14.1 工作台

- 顶部展示运行中/失败 Run、待处理退化 Case、最近验收状态。
- 精度卡必须显示 baseline/candidate 身份、数据集和配置可比性。
- 性能卡同时展示绝对值和相对变化，避免只展示百分比。
- 洞察为可解释规则生成，必须链接到支持该结论的 Run/Case。

### 14.2 Run 创建器

三步：场景 → 配置 → 确认。

- 场景决定所需字段与 Collector。
- 配置页同时提供表单模式和高级原始配置模式。
- 确认页展示实际命令、输出目录、敏感字段遮罩和预计任务矩阵大小。
- 默认“先保存后执行”，执行是明确动作。

### 14.3 Case Diff

- 默认只加载摘要；点开后延迟加载完整输入输出。
- 支持正确性方向、能力桶、错误类型、Judge、延迟区间和文本搜索。
- baseline/candidate 内容必须左右固定，颜色不能作为唯一正确性提示。
- 用户标签与自动标签分开显示。

### 14.4 可访问性与响应式

- 所有交互支持键盘和可见焦点。
- 状态使用图标/文本/颜色三重表达。
- 桌面优先；窄屏保持查看能力，复杂配置编辑可提示切换桌面。

## 15. 安全与隐私

- 默认绑定 `127.0.0.1`；监听非 loopback 时必须显式参数并显示风险警告。
- P0 不提供远程认证，因此不应直接暴露到公网。
- 防止目录穿越、任意命令执行、超大请求体和恶意配置导入。
- JSON/Python 配置导入：P0 Python 配置交由 AISBench 子进程解析，Platform 不在 Web 进程内 `exec`。
- 所有页面输出做 HTML 转义；日志作为纯文本返回。
- 可配置脱敏规则；报告默认不包含 prompt/output 全文。

## 16. 可观测性

平台自身需输出结构化日志：request_id、run_id、component、event、duration、error_code。关键内部指标包括队列长度、运行进程数、Collector 耗时、解析失败率、数据库大小与 artifact 占用。

错误分类：

- `CONFIG_*`：配置与兼容性问题。
- `ENV_*`：依赖、权限、网络、镜像、磁盘问题。
- `RUNNER_*`：子进程启动、退出、取消问题。
- `COLLECTOR_*`：结果缺失或解析失败。
- `ANALYSIS_*`：Run 不可比、Case 无法匹配。

## 17. 测试策略

1. 单元测试：状态机、路径校验、配置归一化、指标计算、Case 匹配。
2. Contract 测试：各 AISBench 版本 fixture 的结果解析。
3. API 测试：合法/非法输入、分页、并发更新和错误格式。
4. 集成测试：使用 fake runner 模拟成功、失败、超时、中断与大日志。
5. 端到端测试：创建 Run、观察完成、对比、筛选 Case、重跑。
6. 安全测试：路径穿越、命令注入、XSS、敏感信息泄露和超大上传。
7. 恢复测试：平台在 RUNNING/COLLECTING 阶段异常退出后的状态恢复。

P0 发布门槛：核心状态机与 Adapter 覆盖率 ≥80%，所有结果解析器必须有固定 fixture；真实 AISBench 冒烟覆盖 accuracy 与 perf 各一条。

## 18. 部署设计

### 18.1 单机开发者模式

`aisbench-platform --host 127.0.0.1 --port 8000 --data-dir ~/.aisbench-platform`

浏览器与服务同机，Platform 以子进程调用 PATH 中已安装的 AISBench。

### 18.2 客户内网服务化模式（P1）

- Platform Control Plane 部署为内网服务。
- 每个执行节点运行轻量 Agent/Collector。
- mTLS/Token 认证，任务通过受控队列下发。
- artifact 可选共享文件系统或对象存储。

## 19. P0 实施拆分

### M0：可交互原型（当前）

- 独立仓库与本地启动入口。
- 六个核心页面、演示数据、本地 Run 创建与重跑。
- 基础本地 API 与 JSON 状态。

### M1：真实 Run 闭环

- SQLite schema 与迁移。
- AISBench Adapter、版本探测、配置预检。
- 进程状态机、取消、日志流与重启恢复。
- accuracy/perf 真实结果 Collector。

### M2：定位闭环

- baseline/candidate 可比性校验。
- Case Diff、能力桶、错误分类与 case manifest 重跑。
- 多 Run 性能表格与阈值验收。

### M3：场景与交付

- Prefix Cache Workload Builder 与 `/metrics` 采集。
- 配置模板/版本、CSV 与 HTML/PDF 报告。
- 安全加固、容量管理与完整 E2E。

## 20. P1 演进

- Agent/Collector 多机架构。
- DP/PD 分离、多实例、多端口指标聚合。
- 配置扫描与自动生成性能曲线。
- Trace、环境快照、断点续跑和批量回归。
- Dataset/Metric/Judge/Runner 插件元数据与市场化入口。
- CI 门禁与外部 baseline API 导入。

## 21. 关键决策与待确认事项

已确定：

- Platform 与 AISBench 分仓，依赖稳定 CLI/结果协议。
- P0 本地优先、单用户、默认 loopback。
- Run 和 ConfigRevision 不可变，重跑生成新资产。
- 原始产物与结构化索引分离。

进入 M1 前需要确认：

1. AISBench 当前各模式可承诺的稳定结果文件清单与版本策略。
2. 首个真实交付场景优先级：精度迁移、通用性能还是 Prefix Cache。
3. P0 正式版前端是否继续零构建静态方案，还是迁移到 React/Vue。
4. 客户环境的支持系统、Python 版本和 AISBench 安装方式。
5. Case 输入输出是否允许默认落盘，以及需要的脱敏等级。
