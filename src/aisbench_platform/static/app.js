const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let state={runs:[],cases:[],projects:[]}, view='overview', liveTimer=null, runFilter='all', caseFilter='all', perfMetric='qps';
const labels={overview:'工作台',runs:'Run 管理',compare:'基线对齐',cases:'Case Diff',workloads:'Workload',perfcompare:'性能曲线对比',monitor:'Grafana 实时监控',configs:'配置中心'};
const fmt=v=>v??'—';
const statusLabel={completed:'已完成',running:'运行中',failed:'失败',queued:'排队中',needs_config:'待补配置'};
const tourSteps=[
  {view:'overview',glyph:'◎',title:'从跑分工具到本地 EvalOps',text:'把一次性命令变成可管理的 Run 资产，串起编排、采集、对比、定位与重跑。'},
  {view:'compare',glyph:'⇄',title:'GPU / NPU 迁移对齐',text:'以 GPU 为 baseline、NPU 为 candidate，同时查看总分、能力桶与方向变化，快速判断是否达到迁移验收标准。'},
  {view:'cases',glyph:'⌁',title:'从总分下钻到错误 Case',text:'筛选 GPU 正确、NPU 错误的样本，查看输出差异与错误标签，并将退化样本一键生成回归任务。'},
  {view:'monitor',glyph:'◉',title:'Grafana 实时性能大盘',text:'所有性能指标通过 Collector 和 Prometheus 接入 Grafana，实时观察 QPS、延迟、吞吐、缓存命中率、实例健康度与告警。'},
  {view:'runs',glyph:'✓',title:'形成可复现的 Run 资产',text:'每次迁移和调优都保留配置、环境、日志、指标与 Case。Demo 展示完整产品闭环，正式版再接入真实 Runner。'}
];
let tourStep=0;
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}
async function api(path,options){const r=await fetch(path,{headers:{'Content-Type':'application/json'},...options});const data=await r.json();if(!r.ok)throw Error(data.error||'请求失败');return data}
function statCard(label,value,sub,tone){return `<div class="card kpi" style="--tone:${tone}"><label>${label}</label><strong>${value}</strong><small>${sub}</small></div>`}
function status(s){return `<span class="status ${s}">${statusLabel[s]||s}</span>`}
function runTable(runs=state.runs){const filtered=runFilter==='all'?runs:runs.filter(r=>r.kind===runFilter);return `<div class="card table-card"><div class="table-toolbar"><h2>Run 资产 <small class="result-count">${filtered.length} 条</small></h2><div class="filters"><button data-run-filter="all" class="${runFilter==='all'?'on':''}">全部</button><button data-run-filter="accuracy" class="${runFilter==='accuracy'?'on':''}">精度</button><button data-run-filter="performance" class="${runFilter==='performance'?'on':''}">性能</button><button data-run-filter="agent" class="${runFilter==='agent'?'on':''}">Agent</button></div></div><div style="overflow:auto"><table><thead><tr><th>RUN</th><th>状态</th><th>后端</th><th>模型 / 数据集</th><th>创建时间</th><th>核心指标</th></tr></thead><tbody>${filtered.length?filtered.map(r=>`<tr class="clickable" data-run="${r.id}"><td><strong>${r.name}</strong><span class="mono">${r.id}</span></td><td>${status(r.status)}</td><td>${r.backend}</td><td><strong>${r.model}</strong>${r.dataset}</td><td>${r.created_at.slice(0,16).replace('T',' ')}</td><td class="metric-value">${r.kind==='accuracy'?`${fmt(r.metrics.score)} 分`:`${fmt(r.metrics.qps)} QPS`}</td></tr>`).join(''):`<tr><td colspan="6" class="empty-row">当前没有 ${runFilter==='agent'?'Agent':'对应'} Run · 点击右上角新建</td></tr>`}</tbody></table></div></div>`}
function overview(){const gpu=state.runs.find(r=>r.id==='run-gpu-baseline'),npu=state.runs.find(r=>r.id==='run-npu-candidate'),perf=state.runs.filter(r=>r.kind==='performance');return `<div class="hero"><div><span class="eyebrow">LOCAL EVALOPS · P0</span><h1>从跑分，到可定位的迁移闭环</h1><p>编排、采集、对比、定位、重跑——所有数据留在本机。</p></div><span class="stamp">数据更新于刚刚</span></div><div class="grid kpis">${statCard('活跃 Run',state.runs.length,'↑ 2 本周','#35d5d1')}${statCard('精度差异','-1.2 pt','需关注','#f5b84b')}${statCard('Prefix 命中率','72.4%','↑ 26.3%','#44d394')}${statCard('失败 Case','13','可重跑','#ff6d7a')}</div><div class="grid dashboard"><div class="card section"><div class="section-title"><div><h2>精度基线对齐</h2><p>同模型 · 同数据集 · GPU baseline vs NPU candidate</p></div><button class="link" data-go="compare">查看 Case Diff →</button></div><div class="alignment"><div class="platform"><div class="platform-top"><b>GPU Baseline</b><span class="chip">vLLM</span></div><div class="score"><strong>${gpu?.metrics.score}</strong><span>CEval Score</span></div><div class="bar"><i style="width:${gpu?.metrics.score}%"></i></div></div><div class="delta"><b>−1.2</b>差异</div><div class="platform"><div class="platform-top"><b>NPU Candidate</b><span class="chip">MindIE</span></div><div class="score"><strong>${npu?.metrics.score}</strong><span>CEval Score</span></div><div class="bar"><i style="width:${npu?.metrics.score}%"></i></div></div></div><div class="insight">定位提示：总分已接近，但有 13 个 Case 发生“GPU 正确 → NPU 错误”；建议优先检查逻辑推理与长输出样本。</div></div><div class="card section"><div class="section-title"><div><h2>Prefix Cache 洞察</h2><p>repeat rate 对性能的影响</p></div><button class="link" data-go="workloads">进入调优 →</button></div>${[['Hit rate',72.4,72],['QPS',21.4,81],['TTFT 改善',26.8,62],['吞吐提升',16.0,49]].map(x=>`<div class="metric-row"><span>${x[0]}</span><div class="bar"><i style="width:${x[2]}%"></i></div><b>${x[1]}${x[0]==='QPS'?'':'%'}</b></div>`).join('')}<div class="insight">命中率从 46.1% 提升到 72.4% 时，QPS 提升 14.4%，TTFT 降低 68ms。</div></div></div><div style="height:16px"></div>${runTable(state.runs.slice(0,4))}`}
function compare(){const acc=state.runs.filter(r=>r.kind==='accuracy');return `<div class="hero"><div><span class="eyebrow">BASELINE ALIGNMENT</span><h1>GPU / NPU 基线对齐</h1><p>不只看总分，定位每一个能力桶与样本差异。</p></div></div><div class="grid kpis">${statCard('GPU Score','72.8','baseline','#4c8dff')}${statCard('NPU Score','71.6','candidate','#35d5d1')}${statCard('一致 Case','1,251','93.2%','#44d394')}${statCard('方向变化','26','13 退化 / 13 改善','#f5b84b')}</div><div class="card section"><div class="section-title"><div><h2>能力桶差异</h2><p>CEval 样本分类聚合</p></div></div>${[['知识理解',78.2,77.8],['逻辑推理',69.4,65.1],['数学计算',71.8,72.3],['代码能力',73.6,71.2],['长文本',67.2,64.8]].map(x=>`<div class="metric-row" style="grid-template-columns:110px 1fr 120px"><span>${x[0]}</span><div><div class="bar"><i style="width:${x[1]}%"></i></div><div class="bar"><i style="width:${x[2]}%;background:linear-gradient(90deg,#f5b84b,#e16f67)"></i></div></div><b class="${x[2]>=x[1]?'diff-pos':'diff-neg'}">${x[1]} → ${x[2]}</b></div>`).join('')}</div><div style="height:16px"></div>${runTable(acc)}`}
function cases(){const visible=state.cases.filter(c=>caseFilter==='all'||(caseFilter==='regress'&&c.baseline_ok&&!c.candidate_ok)||(caseFilter==='improve'&&!c.baseline_ok&&c.candidate_ok)||(caseFilter==='diff'&&c.tag==='输出差异'));return `<div class="hero"><div><span class="eyebrow">CASE DIFF</span><h1>样本级差异定位</h1><p>将总分差异展开为可筛选、可归类、可重跑的错误 Case。</p></div><button class="primary" id="rerunCases">↻ 重跑选中 Case</button></div><div class="pill-row"><button data-case-filter="all" class="pill ${caseFilter==='all'?'on':''}">全部 ${state.cases.length}</button><button data-case-filter="regress" class="pill ${caseFilter==='regress'?'on':''}">GPU✓ → NPU✕</button><button data-case-filter="improve" class="pill ${caseFilter==='improve'?'on':''}">GPU✕ → NPU✓</button><button data-case-filter="diff" class="pill ${caseFilter==='diff'?'on':''}">输出差异</button></div><div class="card table-card"><div style="overflow:auto"><table><thead><tr><th>CASE</th><th>类别 / 问题</th><th>GPU BASELINE</th><th>NPU CANDIDATE</th><th>标签</th></tr></thead><tbody>${visible.map(c=>`<tr class="case-row" data-case="${c.id}"><td class="mono"><input class="case-check" type="checkbox" style="width:auto;margin-right:8px">${c.id}</td><td class="case-question"><strong>${c.category}</strong>${c.question}</td><td class="case-answer ${c.baseline_ok?'good':'bad'}">${c.baseline_ok?'✓':'✕'} ${c.baseline}</td><td class="case-answer ${c.candidate_ok?'good':'bad'}">${c.candidate_ok?'✓':'✕'} ${c.candidate}</td><td><span class="chip">${c.tag}</span></td></tr>`).join('')}</tbody></table></div></div>`}
function workloads(){const perf=state.runs.filter(r=>r.kind==='performance');return `<div class="hero"><div><span class="eyebrow">WORKLOAD BUILDER</span><h1>场景化性能压测</h1><p>把外部脚本中的高频套路内化为标准 Workload。</p></div><button class="primary" id="workloadRun">＋ 创建压测</button></div><div class="grid dashboard"><div class="card section"><div class="section-title"><div><h2>Prefix Cache 工作流</h2><p>生成 → 预热 → 压测 → 指标采集</p></div><span class="status completed">P0 READY</span></div>${[['01','生成 Prefix 数据','固定/变长输入 · repeat_rate · prefix_num'],['02','预热缓存','按 DP 域预热，可配置 warmup 次数'],['03','执行 AISBench','并发 × 长度 × RPS × 后端'],['04','采集 /metrics','queries · hits · hit rate · TTFT/TPOT']].map(x=>`<div class="workload"><div class="workload-head"><strong><span class="mono" style="color:var(--cyan);margin-right:10px">${x[0]}</span>${x[1]}</strong><span>→</span></div><p>${x[2]}</p></div>`).join('')}</div><div class="card section"><div class="section-title"><div><h2>本次性能评测结果</h2><p>Hit Rate / QPS 趋势</p></div></div><div class="spark">${[28,35,31,46,48,58,63,72,68,79,84,91].map(x=>`<i style="height:${x}%" title="${x}"></i>`).join('')}</div><div class="insight">建议将 repeat_rate 扫描配置保存为模板，后续模型版本直接复用。</div></div></div><div style="height:16px"></div>${runTable(perf)}`}
function monitor(){return `<div class="monitor-head"><div><span class="eyebrow">GRAFANA · LIVE TELEMETRY</span><h1>推理服务实时监控</h1><p>Platform Collector → Prometheus → Grafana · 自动关联 AISBench Run</p></div><div class="monitor-actions"><span class="streaming"><i></i><span id="streamTag">数据流正常 · 5s</span></span><select aria-label="集群"><option>ascend-prod-01</option><option>gpu-baseline</option></select><select id="timeRange" aria-label="时间范围"><option value="300">最近 5 分钟</option><option value="900" selected>最近 15 分钟</option><option value="3600">最近 1 小时</option><option value="21600">最近 6 小时</option><option value="86400">最近 24 小时</option></select><div class="zoom-group" role="group" aria-label="时间缩放"><button class="zoom-btn" id="zoomOut" title="缩小时间跨度 (−)">−</button><button class="zoom-btn" id="zoomReset" title="重置为默认跨度">⟲</button><button class="zoom-btn" id="zoomIn" title="放大时间跨度 (+)">+</button></div></div></div><div class="source-strip"><div><i class="source-ok"></i><span>Prometheus</span><b>UP</b><small>2,418 series</small></div><div><i class="source-ok"></i><span>vLLM /metrics</span><b>UP</b><small>4 instances</small></div><div><i class="source-ok"></i><span>AISBench Collector</span><b>ACTIVE</b><small>run-prefix-072</small></div><div><i class="source-warn"></i><span>告警规则</span><b>1 FIRING</b><small>P99 latency</small></div></div><div class="grafana-grid top-metrics">${[['实时 QPS','21.4','req/s','+8.2%','cyan'],['平均 TTFT','186','ms','−12.4%','green'],['Token 吞吐','3,840','tok/s','+16.0%','blue'],['请求失败率','0.15','%','低于阈值','green'],['Prefix 命中率','72.4','%','+26.3%','amber']].map((m,i)=>`<div class="g-panel stat-panel"><div class="g-title">${m[0]}<span>⋮</span></div><strong id="liveMetric${i}" class="${m[4]}">${m[1]}</strong><small>${m[2]}</small><em>${m[3]}</em></div>`).join('')}</div><div class="grafana-grid charts"><div class="g-panel wide"><div class="g-title">QPS & Token Throughput <span>实时</span></div><canvas id="throughputChart" height="210"></canvas><div class="legend"><i class="l-cyan"></i>QPS <i class="l-blue"></i>Token/s ÷ 200</div></div><div class="g-panel"><div class="g-title">延迟分位数 <span>毫秒</span></div><div class="gauge-wrap"><div class="gauge"><b>1.28s</b><span>P99</span></div><div class="thresholds"><p><i class="l-green"></i>P50 <b>442ms</b></p><p><i class="l-amber"></i>P95 <b>924ms</b></p><p><i class="l-red"></i>P99 <b>1.28s</b></p></div></div></div><div class="g-panel wide"><div class="g-title">TTFT / TPOT 实时趋势 <span>4 instances</span></div><canvas id="latencyChart" height="210"></canvas><div class="legend"><i class="l-green"></i>TTFT <i class="l-amber"></i>TPOT × 10</div></div><div class="g-panel"><div class="g-title">实例健康度 <span>昇腾 NPU</span></div>${[['mindie-0','12.1 QPS','68%','healthy'],['mindie-1','9.3 QPS','71%','healthy'],['vllm-dp-0','11.8 QPS','82%','healthy'],['vllm-dp-1','9.6 QPS','79%','warning']].map(x=>`<div class="instance"><i class="${x[3]}"></i><div><b>${x[0]}</b><small>${x[1]}</small></div><span>NPU ${x[2]}</span></div>`).join('')}</div></div><div class="g-panel alert-panel"><div class="g-title">实时告警与 Run 关联 <span>Grafana Alerting</span></div><div class="alert firing"><i>!</i><div><b>P99 latency above migration threshold</b><p>ascend-prod-01 · mindie-1 · 当前 1.28s / 阈值 1.20s</p></div><span>FIRING · 2m</span><button data-go="cases">定位 Case →</button></div><div class="alert normal"><i>✓</i><div><b>Prefix cache hit rate healthy</b><p>run-prefix-072 · hit rate 72.4% · queries 18,420</p></div><span>NORMAL</span><button data-go="workloads">查看 Run →</button></div></div><div class="pipeline"><span>推理服务 / AISBench</span><b>→</b><span>Collector / Exporter</span><b>→</b><span>Prometheus</span><b>→</b><span class="active-pipe">Grafana Dashboard</span></div>`}
// 时间跨度（秒）→ 标签 / 采样间隔 / 采样点数的预设表
// 不变式：points × step == spanMs（采样点 × 采样间隔 = 总跨度）
// 最大跨度 24h 用 240 点 × 6min 步进，既真实覆盖整天又不会画到卡顿
const TIME_RANGES = {
  300:   { label: '5m',  step: 5 * 1000,      points: 60,   stream: '5s',  tag: '5 分钟' },
  900:   { label: '15m', step: 10 * 1000,     points: 90,   stream: '10s', tag: '15 分钟' },
  3600:  { label: '1h',  step: 30 * 1000,     points: 120,  stream: '30s', tag: '1 小时' },
  21600: { label: '6h',  step: 2 * 60 * 1000, points: 180,  stream: '2m',  tag: '6 小时' },
  86400: { label: '24h', step: 6 * 60 * 1000, points: 240,  stream: '6m',  tag: '24 小时' },
};
// 用户可能通过缩放键走非预设跨度：用同一张表做查找，找不到就按 step 自动选最近档
function findRangeForSpan(spanMs) {
  const want = spanMs / 1000;
  let best = 900, bestDiff = Infinity;
  for (const k of Object.keys(TIME_RANGES)) {
    const diff = Math.abs(+k - want);
    if (diff < bestDiff) { best = +k; bestDiff = diff; }
  }
  return best;
}

// 实时图表：除折线外，底部按系统时间渲染时间轴。
// series: [[v0..vN-1], ...]；timestamps: 与之等长、按从旧到新排列的毫秒时间戳。
// viewStart / viewEnd: 当前可视化窗口在 timestamps 中的下标闭区间（用于支持缩放/平移）。
function drawLiveChart(canvasId, series, colors, timestamps, viewStart, viewEnd) {
  const c = document.getElementById(canvasId);
  if (!c) return;
  const dpr = devicePixelRatio || 1;
  const w = c.clientWidth, h = c.clientHeight;
  c.width = w * dpr; c.height = h * dpr;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);

  // 顶部 10px 给"最新时间"角标；底部 25px 给时间轴；左侧 44px 给 Y 轴文字
  const topPad = 10, bottomPad = 25, leftPad = 44;
  const plotH = h - topPad - bottomPad;
  const plotW = w - leftPad;

  // 视图窗口
  const N = timestamps.length;
  const vs = Math.max(0, viewStart | 0);
  const ve = Math.min(N - 1, viewEnd | 0);
  const span = Math.max(1, ve - vs);

  // 计算 Y 轴 min/max（用于刻度文字与折线缩放）
  let yMin = Infinity, yMax = -Infinity;
  series.forEach(values => {
    for (let i = vs; i <= ve; i++) { const v = values[i]; if (v < yMin) yMin = v; if (v > yMax) yMax = v; }
  });
  if (!isFinite(yMin)) { yMin = 0; yMax = 1; }
  if (yMin === yMax) { yMin -= 0.5; yMax += 0.5; }
  // 取一个"漂亮的"上下限：让最小/最大刻度落在整十/百位上
  const yLo = niceFloor(yMin * 0.9);
  const yHi = niceCeil(yMax * 1.08);

  // 横向网格 + Y 轴刻度文字（5 根）
  const ySteps = 5;
  ctx.strokeStyle = '#1d3042';
  ctx.lineWidth = 1;
  ctx.font = '9px Consolas, monospace';
  ctx.fillStyle = '#71879b';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (let i = 0; i <= ySteps; i++) {
    const y = topPad + plotH * i / ySteps;
    ctx.beginPath(); ctx.moveTo(leftPad, y); ctx.lineTo(w, y); ctx.stroke();
    const v = yHi - (yHi - yLo) * i / ySteps;
    ctx.fillText(formatY(v), leftPad - 4, y);
  }

  // Y 轴轴线（左侧浅色竖线，强化"Grafana 风格"）
  ctx.strokeStyle = '#24384b';
  ctx.beginPath(); ctx.moveTo(leftPad + 0.5, topPad); ctx.lineTo(leftPad + 0.5, h - bottomPad); ctx.stroke();

  // 折线（按视图窗口切片）
  series.forEach((values, si) => {
    ctx.strokeStyle = colors[si];
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = vs; i <= ve; i++) {
      const v = values[i];
      const x = leftPad + (i - vs) * plotW / span;
      const y = topPad + plotH - (v - yLo) / (yHi - yLo) * plotH;
      i === vs ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  });

  // X 轴时间标签：跨度 ≥ 1 天用 MM-DD HH:mm；≥ 1 小时用 MM-DD HH:mm；其它用 HH:MM:SS
  if (timestamps.length) {
    const spanMs = timestamps[ve] - timestamps[vs];
    const fmt = t => {
      const d = new Date(t);
      if (Number.isNaN(d.getTime())) return '';
      if (spanMs >= 12 * 3600 * 1000) {
        // 跨天级别：显示日期+时分
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        return `${m}-${day} ${hh}:${mm}`;
      }
      return d.toLocaleTimeString('zh-CN', { hour12: false });
    };
    const first = fmt(timestamps[vs]);
    const last = fmt(timestamps[ve]);
    const mid = fmt(timestamps[Math.round((vs + ve) / 2)]);

    ctx.font = '9px Consolas, monospace';
    ctx.fillStyle = '#71879b';
    ctx.textBaseline = 'top';

    // 末端细分刻度：约 6 根
    ctx.strokeStyle = '#24384b';
    const ticks = 6;
    for (let i = 0; i <= ticks; i++) {
      const idx = vs + Math.round((ve - vs) * i / ticks);
      const x = leftPad + (idx - vs) * plotW / span;
      ctx.beginPath(); ctx.moveTo(x, h - bottomPad); ctx.lineTo(x, h - bottomPad + 3); ctx.stroke();
    }

    ctx.textAlign = 'left';   ctx.fillText(first, leftPad, h - bottomPad + 5);
    ctx.textAlign = 'center'; ctx.fillText(mid, leftPad + plotW / 2, h - bottomPad + 5);
    ctx.textAlign = 'right';  ctx.fillText(last, w - 4, h - bottomPad + 5);

    // 右上角"最新时间"角标
    if (last) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#35d5d1';
      ctx.font = 'bold 9px Consolas, monospace';
      ctx.fillText(`● ${last}`, w - 6, 2);
    }
  }
}

// 全局监控状态：保存当前跨度、视图窗口、缩放档位与所有 series
const monitorState = {
  spanMs: 900 * 1000,           // 当前时间跨度（毫秒）；最大 86400 * 1000 = 1 天
  points: 90,                   // 当前 series 的点数
  step: 5000,                   // 当前采样间隔（毫秒）
  stream: '5s',                 // 顶部"数据流"角标
  viewStart: 0,                 // 视图窗口起点下标
  viewEnd: 0,                   // 视图窗口终点下标（最后一点）
  zoomLevel: 0,                 // 缩放档位，0=默认；+1/-1 表缩小/放大
  qps: [], tokens: [], ttft: [], tpot: [], timestamps: [],
};

// 让 Y 轴刻度落在 1·2·5 × 10^n 的"漂亮"整数上（例如 0.9 → 1，182 → 200，3840 → 4000）
function niceFloor(v) {
  if (v === 0) return 0;
  const sign = v < 0 ? -1 : 1;
  const abs = Math.abs(v);
  const exp = Math.floor(Math.log10(abs));
  const base = Math.pow(10, exp);
  // base * step 给出 nice 值；step ∈ {1, 2, 5}
  let step;
  const norm = abs / base;             // ∈ [1, 10)
  if (norm < 2) step = 1;
  else if (norm < 5) step = 2;
  else step = 5;
  return sign * step * base;
}
function niceCeil(v) {
  if (v === 0) return 0;
  const sign = v < 0 ? -1 : 1;
  const abs = Math.abs(v);
  const exp = Math.floor(Math.log10(abs));
  const base = Math.pow(10, exp);
  let step;
  const norm = abs / base;
  if (norm <= 1) step = 1;
  else if (norm <= 2) step = 2;
  else if (norm <= 5) step = 5;
  else step = 10;
  return sign * step * base;
}
// Y 轴数值格式化：≥ 10000 用 k / M；< 1 用 3 位小数；其它按量级选 0/1/2 位小数
function formatY(v) {
  const abs = Math.abs(v);
  if (abs >= 1e7) return (v / 1e6).toFixed(0) + 'M';
  if (abs >= 1e4) return (v / 1e3).toFixed(abs >= 1e5 ? 0 : 1) + 'k';
  if (abs >= 100) return v.toFixed(0);
  if (abs >= 10)  return v.toFixed(1);
  if (abs >= 1)   return v.toFixed(2);
  return v.toFixed(3);
}

// 用确定性合成（按 step 和 i 的函数）生成数据，避免每次重渲染时整条曲线抖动
function synthSeries(points, step, baseline, amp, freq) {
  const out = new Array(points);
  for (let i = 0; i < points; i++) {
    const t = i * step / 1000;
    out[i] = baseline + Math.sin(t / freq) * amp + (Math.sin(t / (freq / 3)) * (amp * 0.3));
  }
  return out;
}

// 重新生成 series（点数 + step 都跟着跨度走）
function rebuildSeries(spanMs) {
  const preset = TIME_RANGES[findRangeForSpan(spanMs)];
  monitorState.spanMs = preset.label === '24h' ? 86400 * 1000 : (Number(Object.keys(TIME_RANGES).find(k => TIME_RANGES[k].label === preset.label)) * 1000);
  monitorState.points = preset.points;
  monitorState.step = preset.step;
  monitorState.stream = preset.stream;
  monitorState.zoomLevel = 0;
  monitorState.viewStart = 0;
  monitorState.viewEnd = preset.points - 1;
  // 模拟"系统时间": series 末端对齐 Date.now()
  const now = Date.now();
  monitorState.timestamps = Array.from({ length: preset.points }, (_, i) => now - (preset.points - 1 - i) * preset.step);
  monitorState.qps = synthSeries(preset.points, preset.step, 21.4, 4.2, 90);
  monitorState.tokens = monitorState.qps.map(v => v * 180 + Math.sin(v) * 120 + 240);
  monitorState.ttft = synthSeries(preset.points, preset.step, 186, 38, 120);
  monitorState.tpot = synthSeries(preset.points, preset.step, 13.8, 2.6, 60);
}

function startLiveMonitor() {
  rebuildSeries(monitorState.spanMs);
  const tag = TIME_RANGES[findRangeForSpan(monitorState.spanMs)].tag;

  const tick = () => {
    const ms = monitorState;
    drawLiveChart('throughputChart', [ms.qps, ms.tokens.map(x => x / 200)], ['#35d5d1', '#4c8dff'], ms.timestamps, ms.viewStart, ms.viewEnd);
    drawLiveChart('latencyChart', [ms.ttft, ms.tpot], ['#44d394', '#f5b84b'], ms.timestamps, ms.viewStart, ms.viewEnd);

    // 顶部 stat panel 数值（用视图窗口内的最新值）
    const last = N => ms[N].at(-1);
    const vals = [last('qps'), last('ttft'), last('tokens'), .12 + Math.random() * .08, 70 + Math.random() * 4];
    vals.forEach((v, i) => {
      const e = document.getElementById(`liveMetric${i}`);
      if (e) e.textContent = i === 0 ? v.toFixed(1) : i === 1 ? Math.round(v) : i === 2 ? Math.round(v).toLocaleString() : v.toFixed(2);
    });

    // "实时"滚动：每隔一个 step 才追加一个新点；跨度 ≤ 1h 才持续推进（更大跨度演示足够）
    if (ms.spanMs <= 3600 * 1000) {
      const lastTs = ms.timestamps.at(-1);
      if (Date.now() - lastTs >= ms.step) {
        ms.qps.push(19 + Math.random() * 4);
        ms.tokens.push(ms.qps.at(-1) * (175 + Math.random() * 15));
        ms.ttft.push(178 + Math.random() * 28);
        ms.tpot.push(132 + Math.random() * 12);
        ms.timestamps.push(Date.now());
        // 保持窗口等长
        [ms.qps, ms.tokens, ms.ttft, ms.tpot, ms.timestamps].forEach(x => x.shift());
        if (ms.viewEnd > 0) ms.viewEnd = ms.points - 1;
      }
    }
  };
  tick();
  liveTimer = setInterval(tick, 1000);
}

// 缩放：调整 zoomLevel，重新计算视图窗口的起止下标
// zoomLevel > 0 表"放大"（视图窗口更短）；zoomLevel < 0 表"缩小"（视图窗口更长，但不能超过全部数据）
// 受 SPEC 限制：最大跨度 = 24h（用户要求），最小跨度 = 1m
function applyZoom(delta) {
  const ms = monitorState;
  ms.zoomLevel += delta;
  const minSpan = 60 * 1000;            // 最细到 1 分钟
  const maxSpan = 24 * 3600 * 1000;     // 最粗到 24 小时
  // 当前视图跨度（毫秒）
  const viewSpanMs = ms.timestamps[ms.viewEnd] - ms.timestamps[ms.viewStart];
  let nextSpan = viewSpanMs * (delta > 0 ? 0.5 : 2);
  if (nextSpan < minSpan) nextSpan = minSpan;
  if (nextSpan > maxSpan) nextSpan = maxSpan;
  if (nextSpan === viewSpanMs) return;
  // 把"最新时间"作为右锚点，按 nextSpan 反算 viewStart 下标
  const anchorEnd = ms.viewEnd;
  const spanIdx = Math.max(1, Math.round(nextSpan / ms.step));
  ms.viewStart = Math.max(0, anchorEnd - spanIdx);
  ms.viewEnd = anchorEnd;
  // 如果跨度已经覆盖全部点，归零 zoomLevel
  if (ms.viewStart === 0 && ms.viewEnd === ms.points - 1) ms.zoomLevel = 0;
  redrawMonitor();
}

function redrawMonitor() {
  const ms = monitorState;
  drawLiveChart('throughputChart', [ms.qps, ms.tokens.map(x => x / 200)], ['#35d5d1', '#4c8dff'], ms.timestamps, ms.viewStart, ms.viewEnd);
  drawLiveChart('latencyChart', [ms.ttft, ms.tpot], ['#44d394', '#f5b84b'], ms.timestamps, ms.viewStart, ms.viewEnd);
  // 同步顶部"数据流"角标文字
  const tag = document.getElementById('streamTag');
  if (tag) tag.textContent = `数据流正常 · ${ms.stream}`;
}

// 给两张图绑定滚轮缩放 + 拖拽平移
function bindMonitorInteractions() {
  const setup = canvasId => {
    const c = document.getElementById(canvasId);
    if (!c) return;
    c.style.touchAction = 'none';
    c.addEventListener('wheel', e => {
      e.preventDefault();
      applyZoom(e.deltaY < 0 ? 1 : -1);
    }, { passive: false });
    let dragging = false, startX = 0, startVs = 0, startVe = 0;
    c.addEventListener('mousedown', e => { dragging = true; startX = e.clientX; startVs = monitorState.viewStart; startVe = monitorState.viewEnd; });
    window.addEventListener('mouseup', () => { dragging = false; });
    c.addEventListener('mouseleave', () => { dragging = false; });
    c.addEventListener('mousemove', e => {
      if (!dragging) return;
      const ms = monitorState;
      const span = Math.max(1, startVe - startVs);
      const dx = e.clientX - startX;
      const w = c.clientWidth || 1;
      const shiftIdx = -Math.round(dx / w * span);
      let vs = startVs + shiftIdx;
      let ve = startVe + shiftIdx;
      if (vs < 0) { ve -= vs; vs = 0; }
      if (ve > ms.points - 1) { vs -= (ve - (ms.points - 1)); ve = ms.points - 1; }
      if (vs < 0) vs = 0;
      ms.viewStart = vs; ms.viewEnd = ve;
      redrawMonitor();
    });
  };
  setup('throughputChart');
  setup('latencyChart');
}
function configs(){const cfg=state.runs[0]?.config||{};return `<div class="hero"><div><span class="eyebrow">CONFIG MANAGER</span><h1>可复现配置中心</h1><p>保存、导入、导出与复用每一次评测配置。</p></div><button class="primary" id="exportConfig">↓ 导出 JSON</button></div><div class="grid detail-grid"><div class="card section"><div class="section-title"><div><h2>当前配置</h2><p>UI 表单与 AISBench CLI 参数保持一一映射</p></div></div><div class="config-block">${JSON.stringify(cfg,null,2)}</div></div><div class="card section"><div class="section-title"><div><h2>配置模板</h2><p>常用场景一键复用</p></div></div>${['GPU → NPU 精度对齐','Prefix Cache 扫描','长上下文性能压测','Code Agent 子集回归'].map((x,i)=>`<div class="workload"><div class="workload-head"><strong>${x}</strong><span class="chip">${i<2?'内置':'草稿'}</span></div><p>${['baseline + candidate + Case Diff','repeat 率 × prefix 数 × 并发','8K / 32K / 128K 输入矩阵','失败续跑 + 环境日志'][i]}</p></div>`).join('')}</div></div>`}
function runs(){return `<div class="hero"><div><span class="eyebrow">RUN ASSETS</span><h1>Run 管理</h1><p>每次迁移、调优和回归都沉淀为可比较的本地资产。</p></div><button class="primary" id="runPageNew">＋ 新建 Run</button></div>${runTable()}`}
function runDetail(id){const r=state.runs.find(x=>x.id===id);if(!r)return;$('#crumb').textContent='Run 详情';$('#app').innerHTML=`<button class="back" id="backRuns">← 返回 Run 管理</button><div class="detail-head"><div><span class="eyebrow mono">${r.id}</span><h1>${r.name}</h1><p>${r.model} · ${r.dataset}</p></div>${status(r.status)}</div><div class="grid kpis">${Object.entries(r.metrics).slice(0,4).map(([k,v],i)=>statCard(k.replaceAll('_',' ').toUpperCase(),v, i===0?'核心指标':'','#35d5d1')).join('')||statCard('任务状态',statusLabel[r.status],'等待采集','#f5b84b')}</div><div class="grid detail-grid"><div class="card section"><div class="section-title"><div><h2>运行配置</h2><p>创建时完整快照</p></div></div><div class="config-block">${JSON.stringify(r.config,null,2)}</div></div><div class="card section"><div class="section-title"><div><h2>执行信息</h2></div></div><div class="workload"><strong>后端</strong><p>${r.backend}</p></div><div class="workload"><strong>耗时</strong><p>${r.duration}</p></div><div class="workload"><strong>日志</strong><p>${r.log_path||'任务执行后生成'}</p></div><button class="primary" id="rerunOne" style="width:100%;margin-top:8px">↻ 使用相同配置重跑</button></div></div>`;$('#backRuns').onclick=()=>navigate('runs');$('#rerunOne').onclick=async()=>{await api(`/api/runs/${id}/rerun`,{method:'POST',body:'{}'});await load();navigate('runs');toast('已创建重跑任务')};}
function bind(){$$('[data-run]').forEach(x=>x.onclick=()=>runDetail(x.dataset.run));$$('[data-go]').forEach(x=>x.onclick=()=>navigate(x.dataset.go));$$('[data-run-filter]').forEach(x=>x.onclick=()=>{runFilter=x.dataset.runFilter;render();toast(`已筛选：${x.textContent.trim()}`)});$$('[data-case-filter]').forEach(x=>x.onclick=()=>{caseFilter=x.dataset.caseFilter;render()});$('#runPageNew')?.addEventListener('click',openRun);$('#workloadRun')?.addEventListener('click',openRun);$('#rerunCases')?.addEventListener('click',()=>{const count=$$('.case-check:checked').length;toast(count?`已创建 ${count} 个 Case 的子集重跑任务`:'请先勾选需要重跑的 Case')});$('#exportConfig')?.addEventListener('click',exportConfig);$$('.workload').forEach(x=>x.onclick=()=>{x.classList.toggle('selected-demo');toast(view==='configs'?'配置模板已载入编辑器':'Workload 模板已选中，可创建压测')});$$('.source-strip>div').forEach(x=>x.onclick=()=>toast(`${x.querySelector('span')?.textContent} 连接详情：状态正常`));$$('.g-panel').forEach(x=>x.onclick=e=>{if(e.target.closest('button')||e.target.closest('canvas')||e.target.closest('.zoom-group'))return;toast('已展开面板：可查看查询语句、标签和历史数据')});const rangeSel=document.getElementById('timeRange');if(rangeSel)rangeSel.onchange=e=>{const sec=+e.target.value;rebuildSeries(sec*1000);redrawMonitor();toast(`时间范围已切换为：${TIME_RANGES[findRangeForSpan(sec*1000)].tag}`)};const zIn=document.getElementById('zoomIn'),zOut=document.getElementById('zoomOut'),zRst=document.getElementById('zoomReset');if(zIn)zIn.onclick=()=>applyZoom(1);if(zOut)zOut.onclick=()=>applyZoom(-1);if(zRst)zRst.onclick=()=>{rebuildSeries(monitorState.spanMs);redrawMonitor();toast('已重置为默认跨度')};$$('.monitor-actions select:not(#timeRange)').forEach(x=>x.onchange=()=>toast(`监控范围已切换为：${x.value}`));if(view==='monitor'){startLiveMonitor();bindMonitorInteractions()}}
function render(){const views={overview,runs,compare,cases,workloads,perfcompare,monitor,configs};$('#app').innerHTML=(views[view]||overview)();$('#crumb').textContent=labels[view];$$('.nav').forEach(n=>n.classList.toggle('active',n.dataset.view===view));bind();if(view==='perfcompare')bindPerfComparison()}
function navigate(v){if(liveTimer){clearInterval(liveTimer);liveTimer=null}view=v;render();history.replaceState(null,'',`#${v}`)}
function openRun(){$('#runDialog').showModal()}
function showTour(step=0){tourStep=step;const s=tourSteps[step];navigate(s.view);$('#tourIndex').textContent=`${String(step+1).padStart(2,'0')} / 05`;$('#tourGlyph').textContent=s.glyph;$('#tourTitle').textContent=s.title;$('#tourText').textContent=s.text;$('#tourDots').innerHTML=tourSteps.map((_,i)=>`<i class="${i===step?'on':''}"></i>`).join('');$('#tourNext').textContent=step===tourSteps.length-1?'完成导览 ✓':'下一步 →';if(!$('#tourDialog').open)$('#tourDialog').showModal()}
function exportConfig(){const blob=new Blob([JSON.stringify(state.runs[0]?.config||{},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='aisbench-config.json';a.click();URL.revokeObjectURL(a.href);toast('配置已导出')}
function exportPerformanceExcel(){const runs=state.runs.filter(r=>r.kind==='performance');if(!runs.length){toast('当前没有可导出的性能 Run');return}const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');const cols=['Run ID','Run 名称','状态','创建时间','后端','模型','Workload','并发','输入长度','输出长度','TTFT(ms)','TPOT(ms)','吞吐(tok/s)','QPS','P95(ms)','P99(ms)','失败率(%)','Prefix Cache 命中率(%)'];const rows=runs.map(r=>[r.id,r.name,statusLabel[r.status]||r.status,r.created_at,r.backend,r.model,r.dataset,r.config?.concurrency,r.config?.input_len,r.config?.output_len,r.metrics?.ttft,r.metrics?.tpot,r.metrics?.throughput,r.metrics?.qps,r.metrics?.p95,r.metrics?.p99,r.metrics?.failure_rate,r.metrics?.hit_rate]);const cell=(v,header=false)=>`<Cell ss:StyleID="${header?'Header':'Cell'}"><Data ss:Type="${typeof v==='number'?'Number':'String'}">${esc(v)}</Data></Cell>`;const sheet=`<?xml version="1.0" encoding="UTF-8"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#167D91" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/></Style><Style ss:ID="Cell"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E2EA"/></Borders></Style></Styles><Worksheet ss:Name="多Run性能对比"><Table><Row>${cols.map(x=>cell(x,true)).join('')}</Row>${rows.map(row=>`<Row>${row.map(x=>cell(x)).join('')}</Row>`).join('')}</Table></Worksheet><Worksheet ss:Name="导出说明"><Table><Row>${cell('AISBench Platform 多 Run 性能压测数据',true)}</Row><Row>${cell(`导出时间：${new Date().toLocaleString()}`)}</Row><Row>${cell(`Run 数量：${runs.length}`)}</Row><Row>${cell('Demo 数据仅用于产品演示，正式版由 Collector/Prometheus 提供真实指标。')}</Row></Table></Worksheet></Workbook>`;const blob=new Blob(['\ufeff',sheet],{type:'application/vnd.ms-excel;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`AISBench_多Run性能对比_${new Date().toISOString().slice(0,10)}.xls`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast(`已导出 ${runs.length} 条性能 Run 到 Excel`)}
async function load(){state=await api('/api/state');$('#runCount').textContent=state.runs.length}
$$('.nav').forEach(n=>n.onclick=()=>navigate(n.dataset.view));$('#newRunBtn').onclick=openRun;$('#exportPerfExcel').onclick=exportPerformanceExcel;$('#importBtn').onclick=()=>$('#fileInput').click();$('.mobile-menu').onclick=()=>$('.sidebar').classList.toggle('open');
$('#projectSwitch').onchange=e=>toast(`已切换项目：${e.target.value}`);$('.local').onclick=()=>toast('演示数据仅保存在本机，不会上传外部服务');
$('#tourBtn').onclick=()=>showTour(0);$('#tourClose').onclick=()=>$('#tourDialog').close();$('#tourNext').onclick=()=>{if(tourStep===tourSteps.length-1){$('#tourDialog').close();toast('导览完成，可以自由演示各模块')}else showTour(tourStep+1)};
$('#fileInput').onchange=e=>{const f=e.target.files[0];if(!f)return;const reader=new FileReader();reader.onload=()=>{try{const obj=JSON.parse(reader.result);toast(`已读取配置：${Object.keys(obj).length} 个字段`);navigate('configs')}catch{toast('Python 配置将在创建 Run 时交给 AISBench 解析')}};reader.readAsText(f)};
$('#runForm').addEventListener('submit',async e=>{e.preventDefault();if(e.submitter?.value==='cancel'){$('#runDialog').close();return}const fd=new FormData(e.target),payload={name:fd.get('name'),kind:fd.get('kind'),backend:fd.get('backend'),model:fd.get('model'),dataset:fd.get('dataset'),execute:fd.get('execute')==='on',config:{mode:fd.get('kind')==='performance'?'perf':'all',config_path:fd.get('configPath'),scenario:fd.get('kind')==='performance'?'prefix_cache':undefined}};try{await api('/api/runs',{method:'POST',body:JSON.stringify(payload)});$('#runDialog').close();await load();navigate('runs');toast('Run 已创建，演示队列已更新')}catch(err){toast(err.message)}});
view=location.hash.slice(1)||'overview';load().then(render).catch(err=>{$('#app').innerHTML=`<div class="empty">无法连接本地服务：${err.message}</div>`});
