// 三种扫描维度对应的真实演示数据：每个维度都有自己的 X 轴与各 Run 的指标序列。
// 维度键名必须与 <select id="curveDimension"> 中 option 的顺序一一对应。
const perfCurveData = {
  concurrency: {
    label: '并发度 Concurrency',
    xAxis: [1, 4, 8, 16, 32, 64],
    xTitle: '并发度',
    runs: [
      { id: 'prefix-72', name: 'Prefix Cache · 命中 72%', color: '#35d5d1',
        qps: [1.1, 4.2, 8.1, 14.6, 21.4, 23.1], ttft: [102, 116, 132, 151, 186, 278],
        tpot: [10.8, 11.1, 11.7, 12.4, 13.8, 17.2], throughput: [312, 1160, 2210, 3280, 3840, 4010],
        p95: [310, 384, 472, 618, 924, 1480], p99: [402, 495, 612, 790, 1280, 2140] },
      { id: 'prefix-46', name: 'Prefix Cache · 命中 46%', color: '#4c8dff',
        qps: [1, 3.9, 7.3, 12.8, 18.7, 19.4], ttft: [118, 138, 164, 202, 254, 368],
        tpot: [11.4, 11.8, 12.4, 13.1, 14.1, 18.9], throughput: [284, 1050, 1960, 2890, 3310, 3390],
        p95: [344, 426, 548, 766, 1132, 1790], p99: [438, 552, 706, 982, 1510, 2580] },
      { id: 'cache-off', name: 'Prefix Cache · 关闭', color: '#f5b84b',
        qps: [.9, 3.4, 6.1, 10.2, 14.9, 15.2], ttft: [145, 171, 218, 284, 346, 486],
        tpot: [12.1, 12.6, 13.4, 14.3, 15.7, 21.4], throughput: [256, 918, 1640, 2300, 2670, 2710],
        p95: [398, 512, 684, 936, 1390, 2240], p99: [510, 668, 890, 1210, 1860, 3110] },
    ],
    insight: '拐点：并发度从 32 升到 64 时 TTFT 陡增，QPS 几乎饱和，建议保持 concurrency ≤ 32。',
    workloadNote: 'LLM 推理服务 · input 4096 / output 256 · 昇腾 NPU',
  },
  input_len: {
    label: '输入长度 Input Length',
    xAxis: [512, 1024, 2048, 4096, 8192, 16384],
    xTitle: '输入 token',
    runs: [
      { id: 'prefix-72', name: 'Prefix Cache · 命中 72%', color: '#35d5d1',
        qps: [38.2, 32.4, 26.8, 21.4, 13.7, 7.4], ttft: [62, 88, 128, 186, 312, 564],
        tpot: [9.4, 10.6, 12.1, 13.8, 17.2, 22.8], throughput: [5420, 4980, 4380, 3840, 2760, 1680],
        p95: [210, 398, 612, 924, 1480, 2380], p99: [298, 502, 798, 1280, 1940, 3120] },
      { id: 'prefix-46', name: 'Prefix Cache · 命中 46%', color: '#4c8dff',
        qps: [34.1, 28.6, 23.4, 18.7, 11.8, 6.1], ttft: [78, 112, 168, 254, 408, 712],
        tpot: [10.1, 11.4, 12.8, 14.1, 18.4, 24.6], throughput: [4920, 4480, 3860, 3310, 2360, 1380],
        p95: [262, 472, 718, 1132, 1740, 2680], p99: [366, 612, 942, 1510, 2280, 3540] },
      { id: 'cache-off', name: 'Prefix Cache · 关闭', color: '#f5b84b',
        qps: [27.4, 22.1, 17.9, 14.9, 9.2, 4.6], ttft: [112, 164, 238, 346, 538, 924],
        tpot: [11.6, 13.2, 14.7, 15.7, 20.8, 28.4], throughput: [4180, 3680, 3120, 2670, 1860, 1040],
        p95: [344, 596, 902, 1390, 2120, 3260], p99: [488, 798, 1180, 1860, 2840, 4320] },
    ],
    insight: '输入长度从 4096 翻倍到 8192 时 TTFT 上升约 68%，长上下文场景应开启 Prefix Cache 缓解。',
    workloadNote: 'LLM 推理服务 · concurrency 32 / output 256 · 昇腾 NPU',
  },
  rps: {
    label: '请求速率 RPS',
    xAxis: [5, 10, 20, 40, 80, 160],
    xTitle: 'RPS',
    runs: [
      { id: 'prefix-72', name: 'Prefix Cache · 命中 72%', color: '#35d5d1',
        qps: [4.8, 9.6, 18.2, 21.4, 22.6, 22.9], ttft: [118, 142, 168, 186, 254, 412],
        tpot: [11.2, 11.9, 12.6, 13.8, 15.4, 18.9], throughput: [1620, 2860, 3520, 3840, 3960, 4010],
        p95: [382, 528, 712, 924, 1180, 1620], p99: [512, 698, 942, 1280, 1740, 2380] },
      { id: 'prefix-46', name: 'Prefix Cache · 命中 46%', color: '#4c8dff',
        qps: [4.6, 9.1, 16.4, 18.7, 19.6, 19.8], ttft: [138, 172, 212, 254, 348, 548],
        tpot: [11.8, 12.4, 13.2, 14.1, 16.2, 20.4], throughput: [1480, 2540, 3080, 3310, 3420, 3450],
        p95: [448, 612, 832, 1132, 1480, 2010], p99: [598, 812, 1140, 1510, 2080, 2860] },
      { id: 'cache-off', name: 'Prefix Cache · 关闭', color: '#f5b84b',
        qps: [4.2, 8.1, 13.6, 14.9, 15.4, 15.5], ttft: [176, 224, 288, 346, 472, 738],
        tpot: [12.8, 13.6, 14.6, 15.7, 18.1, 23.6], throughput: [1320, 2240, 2580, 2670, 2740, 2760],
        p95: [582, 798, 1080, 1390, 1810, 2480], p99: [782, 1060, 1480, 1860, 2540, 3480] },
    ],
    insight: '在 40 RPS 之后系统进入饱和，QPS 几乎不再增长但 P95 延迟继续上升，存在排队风险。',
    workloadNote: 'LLM 推理服务 · input 4096 / output 256 · 昇腾 NPU',
  },
};

// 当前选中的维度键，初始为 concurrency；perf-compare 视图自带模块级状态。
let perfDimension = 'concurrency';

function perfcompare() {
  const ms = [['qps', 'QPS'], ['throughput', 'Token 吞吐'], ['ttft', 'TTFT'], ['tpot', 'TPOT'], ['p95', 'P95'], ['p99', 'P99']];
  const label = ms.find(m => m[0] === perfMetric)[1];
  const dim = perfCurveData[perfDimension];
  const xAxis = dim.xAxis;
  const xHeader = xAxis.map(v => `<th>${dim.xTitle} ${v}</th>`).join('');

  return `
    <div class="hero">
      <div><span class="eyebrow">MULTI-RUN CURVE ANALYSIS</span><h1>性能曲线对比</h1>
        <p>横向比较不同配置 Run，定位性能拐点与最优参数区间。</p></div>
      <div class="hero-actions">
        <button class="ghost" id="curveExport">▦ 导出对比 Excel</button>
        <button class="primary" id="saveCompare">＋ 保存对比视图</button>
      </div>
    </div>
    <div class="curve-controls card">
      <div><label>扫描维度</label>
        <select id="curveDimension">
          <option value="concurrency" ${perfDimension === 'concurrency' ? 'selected' : ''}>并发度 Concurrency</option>
          <option value="input_len" ${perfDimension === 'input_len' ? 'selected' : ''}>输入长度 Input Length</option>
          <option value="rps" ${perfDimension === 'rps' ? 'selected' : ''}>请求速率 RPS</option>
        </select>
      </div>
      <div class="metric-tabs">${ms.map(m => `<button data-perf-metric="${m[0]}" class="${perfMetric === m[0] ? 'on' : ''}">${m[1]}</button>`).join('')}</div>
      <div><label>对比模式</label>
        <select id="compareMode"><option>绝对值</option><option>相对基线</option><option>归一化</option></select>
      </div>
    </div>
    <div class="curve-layout">
      <aside class="card run-selector">
        <div class="section-title"><div><h2>对比 Run</h2><p>最多选择 5 条曲线</p></div></div>
        ${dim.runs.map((r, i) => `<label class="run-choice"><input type="checkbox" data-curve-run="${r.id}" checked>
          <i style="background:${r.color}"></i><span><b>${r.name}</b><small>${i === 0 ? 'candidate · run-prefix-072' : i === 1 ? 'baseline · run-prefix-046' : 'reference · cache-off'}</small></span></label>`).join('')}
        <button class="ghost add-curve">＋ 添加历史 Run</button>
      </aside>
      <div class="card curve-main">
        <div class="curve-title">
          <div><h2>${label} vs ${dim.xTitle}</h2><p>${dim.workloadNote}</p></div>
          <span class="chip">${xAxis.length} 个采样点</span>
        </div>
        <canvas id="compareCurve" height="360"></canvas>
        <div id="curveLegend" class="curve-legend"></div>
      </div>
    </div>
    <div class="grid curve-insights">
      <div class="card kpi"><label>最佳配置</label><strong>命中率 72%</strong><small>${dim.label} · ${xAxis[4]}</small></div>
      <div class="card kpi"><label>峰值 QPS</label><strong>${Math.max(...dim.runs[0].qps).toFixed(1)}</strong><small class="diff-pos">较基线 +19.1%</small></div>
      <div class="card kpi"><label>最佳 TTFT</label><strong>${Math.min(...dim.runs[0].ttft)} ms</strong><small class="diff-pos">降低 29.7%</small></div>
      <div class="card kpi"><label>性能拐点</label><strong>${dim.xTitle} ${xAxis[4]}</strong><small>${xAxis[5]} 后延迟陡增</small></div>
    </div>
    <div class="card curve-table">
      <div class="section-title"><div><h2>采样点明细</h2><p>当前指标：${label} · 当前维度：${dim.label}</p></div></div>
      <div style="overflow:auto"><table>
        <thead><tr><th>RUN</th>${xHeader}<th>趋势</th></tr></thead>
        <tbody>${dim.runs.map(r => `<tr data-curve-row="${r.id}"><td><strong><i class="curve-dot" style="background:${r.color}"></i>${r.name}</strong></td>${r[perfMetric].map(v => `<td class="metric-value">${v}</td>`).join('')}<td class="diff-pos">↗</td></tr>`).join('')}</tbody>
      </table></div>
      <div class="insight">${dim.insight}</div>
    </div>`;
}

function drawPerfComparison() {
  const c = document.getElementById('compareCurve');
  if (!c) return;
  const dim = perfCurveData[perfDimension];
  const selected = [...document.querySelectorAll('[data-curve-run]:checked')].map(x => x.dataset.curveRun);
  const runs = dim.runs.filter(r => selected.includes(r.id));
  const dpr = devicePixelRatio || 1;
  const w = c.clientWidth, h = 360;
  const p = { l: 58, r: 24, t: 24, b: 42 };
  c.width = w * dpr; c.height = h * dpr;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  if (!runs.length) { ctx.clearRect(0, 0, w, h); return; }

  const all = runs.flatMap(r => r[perfMetric]);
  const min = Math.min(...all) * 0.88, max = Math.max(...all) * 1.1;
  ctx.font = '10px Inter';
  ctx.fillStyle = '#657f95';
  ctx.strokeStyle = '#1d3042';
  // 网格 + Y 轴刻度
  for (let i = 0; i < 5; i++) {
    const y = p.t + (h - p.t - p.b) * i / 4;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    ctx.fillText((max - (max - min) * i / 4).toFixed(perfMetric === 'qps' || perfMetric === 'tpot' ? 1 : 0), 8, y + 3);
  }
  // X 轴刻度：跟随当前维度
  const xs = dim.xAxis;
  const denom = xs.length > 1 ? xs.length - 1 : 1;
  xs.forEach((v, i) => ctx.fillText(String(v), p.l + (w - p.l - p.r) * i / denom - 8, h - 15));
  // X 轴标题
  ctx.fillText(dim.xTitle, w - p.r - ctx.measureText(dim.xTitle).width, h - 4);

  // 折线
  runs.forEach(r => {
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    r[perfMetric].forEach((v, i) => {
      const x = p.l + (w - p.l - p.r) * i / denom;
      const y = p.t + (max - v) / (max - min) * (h - p.t - p.b);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      ctx.fillStyle = r.color; ctx.fillRect(x - 3, y - 3, 6, 6);
    });
    ctx.stroke();
  });

  // 图例与表格行显隐
  const legend = document.querySelector('#curveLegend');
  if (legend) legend.innerHTML = runs.map(r => `<span><i style="background:${r.color}"></i>${r.name}</span>`).join('');
  document.querySelectorAll('[data-curve-row]').forEach(row => {
    row.style.display = selected.includes(row.dataset.curveRow) ? '' : 'none';
  });
}

function bindPerfComparison() {
  document.querySelectorAll('[data-perf-metric]').forEach(x => x.onclick = () => { perfMetric = x.dataset.perfMetric; render(); });
  document.querySelectorAll('[data-curve-run]').forEach(x => x.onchange = drawPerfComparison);
  const dimSelect = document.querySelector('#curveDimension');
  if (dimSelect) dimSelect.onchange = e => {
    perfDimension = e.target.value;
    render(); // 整页重渲染，确保标题/采样点表头/拐点提示都跟随新维度
    requestAnimationFrame(drawPerfComparison);
  };
  document.querySelector('#compareMode').onchange = e => toast(`对比模式已切换：${e.target.value}`);
  document.querySelector('#saveCompare').onclick = () => toast('性能对比视图已保存到项目');
  document.querySelector('#curveExport').onclick = exportPerformanceExcel;
  document.querySelector('.add-curve').onclick = () => toast('已打开历史性能 Run 选择器');
  requestAnimationFrame(drawPerfComparison);
}