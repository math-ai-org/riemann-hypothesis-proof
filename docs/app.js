/* Riemann Hypothesis in Lean: a map of the project. Data in data/*.json comes from tools/build_data.py. */
(() => {
  const $ = (s) => document.querySelector(s);
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const full = d3.format(',');
  const compact = (n) => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M'
    : n >= 1e4 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : full(n);
  const pct = (a, b) => b ? (100 * a / b).toFixed(a / b < 0.01 ? 2 : 1) + '%' : '–';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const METRIC = { l: 'Lines', f: 'Modules', t: 'Theorems', d: 'Definitions' };

  let D = {}, GROUPS = [];
  const groupColor = (g) => { const i = GROUPS.indexOf(g); return i >= 0 && i < 6 ? css(`--s${i + 1}`) : css('--other'); };
  const libGroup = (lib) => GROUPS.includes(lib) ? lib : 'Other';
  const swatch = (g) => `<span class="sw" style="background:${groupColor(g)}"></span>`;

  /* ---------- tooltip ---------- */
  const tip = $('#tip');
  function showTip(html, ev, el) {
    tip.innerHTML = html; tip.style.opacity = 1;
    const r = tip.getBoundingClientRect();
    let x, y;
    if (ev && ev.clientX != null && ev.type !== 'focus') { x = ev.clientX + 14; y = ev.clientY + 14; }
    else { const b = el.getBoundingClientRect(); x = b.left; y = b.bottom + 8; }
    if (x + r.width > innerWidth - 8) x = innerWidth - r.width - 8;
    if (y + r.height > innerHeight - 8) y = (ev && ev.clientY != null ? ev.clientY : y) - r.height - 14;
    tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px';
  }
  const hideTip = () => { tip.style.opacity = 0; };
  const tipRows = (title, rows) => `<div class="t-title">${title}</div>` +
    rows.map(([k, v]) => `<div class="t-row"><span>${k}</span><b>${v}</b></div>`).join('');

  /* ---------- theme ---------- */
  const themeBtn = $('#theme');
  const THEMES = ['auto', 'light', 'dark'];
  function applyTheme(t) {
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    themeBtn.textContent = 'Theme: ' + t;
    try { localStorage.setItem('rh-theme', t); } catch (e) {}
  }
  let theme = 'auto';
  try { theme = localStorage.getItem('rh-theme') || 'auto'; } catch (e) {}
  applyTheme(theme);
  themeBtn.addEventListener('click', () => { theme = THEMES[(THEMES.indexOf(theme) + 1) % 3]; applyTheme(theme); renderAll(); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (theme === 'auto') renderAll(); });

  /* ---------- ranked horizontal bars (one hue) ---------- */
  function bars(el, rows, opt = {}) {
    const W = el.clientWidth || 800, labelW = Math.min(opt.labelW || 300, W * 0.42), valueW = 64;
    const rowH = 30, barH = 16, H = rows.length * rowH + 6;
    const max = d3.max(rows, (r) => r.value) || 1;
    const x = d3.scaleLinear().domain([0, max]).range([0, W - labelW - valueW - 8]);
    el.innerHTML = '';
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'list');
    const g = svg.selectAll('g.barrow').data(rows).join('g')
      .attr('class', (r) => 'barrow' + (r.onClick ? ' clickable' : ''))
      .attr('transform', (r, i) => `translate(0,${i * rowH + 3})`)
      .attr('role', (r) => r.onClick ? 'button' : 'listitem').attr('tabindex', 0)
      .attr('aria-label', (r) => `${r.label}: ${full(r.value)}` + (r.onClick ? ', open' : ''));
    g.append('rect').attr('class', 'hit').attr('width', W).attr('height', rowH - 2).attr('fill', 'transparent').attr('rx', 6);
    g.each(function (r) {
      const s = d3.select(this);
      let lx = 4;
      if (r.swatch) { s.append('rect').attr('x', 4).attr('y', (rowH - 12) / 2 - 1).attr('width', 10).attr('height', 10).attr('rx', 3).attr('fill', groupColor(r.swatch)); lx = 20; }
      const t = s.append('text').attr('x', lx).attr('y', rowH / 2 + 3).attr('font-size', 13)
        .style('fill', r.muted ? css('--muted') : css('--text-primary')).text(r.label + (r.onClick ? '  ›' : ''));
      const node = t.node(), suffix = r.onClick ? '  ›' : '';
      let txt = r.label;
      while (node.getComputedTextLength() > labelW - lx - 10 && txt.length > 4) { txt = txt.slice(0, -1); t.text(txt + '…' + suffix); }
      const w = Math.max(x(r.value), r.value > 0 ? 2 : 0), y0 = (rowH - barH) / 2 - 1;
      if (w > 0) {
        const rr = Math.min(4, w);
        s.append('path').attr('class', 'bar').attr('fill', r.muted ? css('--other') : css('--s1'))
          .attr('d', `M${labelW},${y0}h${w - rr}a${rr},${rr} 0 0 1 ${rr},${rr}v${barH - 2 * rr}a${rr},${rr} 0 0 1 -${rr},${rr}h-${w - rr}z`);
      }
      s.append('text').attr('x', labelW + w + 6).attr('y', rowH / 2 + 3).attr('font-size', 12)
        .style('font-variant-numeric', 'tabular-nums').style('fill', css('--text-secondary')).text(opt.fmt ? opt.fmt(r.value) : compact(r.value));
    });
    g.on('mouseenter mousemove focus', function (ev, r) { if (r.tip) showTip(r.tip, ev, this); })
      .on('mouseleave blur', hideTip)
      .on('click', (ev, r) => { if (r.onClick) { hideTip(); r.onClick(); } })
      .on('keydown', (ev, r) => { if (r.onClick && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); hideTip(); r.onClick(); } });
  }

  /* ---------- key figures ---------- */
  function renderKpis() {
    const s = D.summary, h = Object.values(s.hatches).reduce((a, b) => a + b, 0);
    const k = [
      ['Lean modules', compact(s.modules), `${full(s.modules)} files under src/`],
      ['Lines of Lean', compact(s.lines), `${(s.bytes / 1e9).toFixed(2)} GB of source`],
      ['Theorems and lemmas', compact(s.theorems), `${full(s.theorems)} declarations`],
      ['Definitions', compact(s.definitions), `def and abbrev, ${full(s.definitions)}`],
      ['Longest import chain', full(s.longestChain), 'modules, from Main down'],
      ['Escape hatches found', full(h), 'sorry, axiom, native_decide, …'],
    ];
    $('#kpis').innerHTML = k.map(([l, v, n]) => `<div class="kpi"><div class="k-label">${l}</div><div class="k-value">${v}</div><div class="k-note">${esc(n)}</div></div>`).join('');
    $('#statements-src').textContent = s.statementsLean.trim();
    $('#main-src').textContent = s.mainLean.trim();
    $('#gen-date').textContent = s.generated;
  }

  /* ---------- folder tree drill-down ---------- */
  let treePath = [], treeMetric = 'l';
  function renderTree() {
    const node = treePath[treePath.length - 1], m = treeMetric, kids = node.c || [];
    const direct = node[m] - d3.sum(kids, (c) => c[m]);
    let rows = kids.map((c) => ({ node: c, label: c.n, value: c[m] }));
    rows.sort((a, b) => b.value - a.value);
    const LIMIT = 18;
    if (rows.length > LIMIT) {
      const rest = rows.slice(LIMIT);
      rows = rows.slice(0, LIMIT);
      rows.push({ label: `${rest.length} more folders`, value: d3.sum(rest, (r) => r.value), muted: true, rest });
    }
    if (direct > 0 && kids.length) rows.push({ label: 'Modules directly in this folder', value: direct, muted: true, directRow: true });
    const top = treePath.length === 1;
    bars($('#tree-chart'), rows.map((r) => {
      const n = r.node;
      const base = n ? n : { f: 0, l: 0, t: 0, d: 0 };
      return {
        label: r.label, value: r.value, muted: r.muted,
        swatch: top && n ? libGroup(n.n) : null,
        onClick: n && n.c ? () => { treePath.push(n); renderTree(); } : null,
        tip: n ? tipRows(esc(n.n), [['Modules', full(n.f)], ['Lines', full(n.l)], ['Theorems', full(n.t)], ['Definitions', full(n.d)], [`Share of ${esc(node.n)} (${METRIC[m].toLowerCase()})`, pct(n[m], node[m])]])
          : tipRows(esc(r.label), [[METRIC[m], full(r.value)], ['Share', pct(r.value, node[m])]]),
      };
    }), { labelW: 300 });
    const cr = $('#tree-crumbs');
    cr.innerHTML = treePath.map((n, i) => i === treePath.length - 1 ? `<span class="here">${esc(n.n)}</span>`
      : `<button type="button" data-i="${i}">${esc(n.n)}</button><span class="sep">/</span>`).join('');
    cr.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { treePath = treePath.slice(0, +b.dataset.i + 1); renderTree(); }));
  }
  $('#tree-metric').addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    treeMetric = b.dataset.m;
    $('#tree-metric').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    renderTree();
  });

  /* ---------- library matrix ---------- */
  function lum(c) { const { r, g, b } = d3.rgb(c); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
  function renderMatrix() {
    const M = D.matrix, el = $('#matrix-chart'), W = el.clientWidth || 900;
    const labelW = 150, top = 96, cols = M.cols.length, rows = M.rows.length;
    const cw = Math.max(44, (W - labelW) / cols), chh = 34, Wt = labelW + cw * cols, H = top + rows * chh + 64;
    const max = d3.max(M.values.flat());
    const ramp = css('--seq').split(',').map((s) => s.trim());
    const t = d3.scaleLog().domain([1, max]).range([0, 1]).clamp(true);
    const color = (v) => d3.interpolateRgbBasis(ramp)(t(v));
    el.innerHTML = '';
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${Wt} ${H}`).attr('role', 'img')
      .attr('aria-label', 'Matrix of import counts between libraries; the table view below lists every value.');
    M.cols.forEach((c, j) => {
      const gx = labelW + j * cw + cw / 2;
      const g = svg.append('g').attr('transform', `translate(${gx},${top - 10}) rotate(-38)`);
      g.append('text').attr('font-size', 12).attr('text-anchor', 'start').text(c);
    });
    M.rows.forEach((r, i) => {
      const y = top + i * chh;
      svg.append('rect').attr('x', 0).attr('y', y + chh / 2 - 6).attr('width', 10).attr('height', 10).attr('rx', 3).attr('fill', groupColor(libGroup(r)));
      svg.append('text').attr('x', 16).attr('y', y + chh / 2 + 4).attr('font-size', 13).style('fill', css('--text-primary')).text(r);
      M.cols.forEach((c, j) => {
        const v = M.values[i][j], x = labelW + j * cw;
        const fill = v > 0 ? color(v) : css('--surface-2');
        const cell = svg.append('g').attr('tabindex', 0).attr('role', 'img').attr('aria-label', `${r} imports from ${c}: ${full(v)}`);
        cell.append('rect').attr('x', x + 1).attr('y', y + 1).attr('width', cw - 2).attr('height', chh - 2).attr('rx', 4).attr('fill', fill);
        if (cw >= 40) cell.append('text').attr('x', x + cw / 2).attr('y', y + chh / 2 + 4).attr('text-anchor', 'middle').attr('font-size', 11.5)
          .style('font-variant-numeric', 'tabular-nums').style('fill', v > 0 ? (lum(fill) > 0.42 ? '#0b0b0b' : '#ffffff') : css('--muted')).text(v > 0 ? compact(v) : '–');
        cell.on('mouseenter mousemove focus', function (ev) {
          showTip(tipRows(`${esc(r)} → ${esc(c)}`, [['Import lines', full(v)], [`Share of ${esc(r)}'s imports`, pct(v, d3.sum(M.values[i]))]]), ev, this);
        }).on('mouseleave blur', hideTip);
      });
    });
    // scale legend
    const ly = top + rows * chh + 22, lw = Math.min(320, Wt - labelW), lx = labelW;
    const defs = svg.append('defs'), gid = 'mgrad';
    const lg = defs.append('linearGradient').attr('id', gid);
    ramp.forEach((c, k) => lg.append('stop').attr('offset', `${(100 * k) / (ramp.length - 1)}%`).attr('stop-color', c));
    svg.append('rect').attr('x', lx).attr('y', ly).attr('width', lw).attr('height', 8).attr('rx', 4).attr('fill', `url(#${gid})`);
    const ticks = [1, 10, 100, 1e3, 1e4, 1e5, 1e6].filter((v) => v <= max);
    ticks.forEach((v) => svg.append('text').attr('x', lx + t(v) * lw).attr('y', ly + 24).attr('text-anchor', 'middle').attr('font-size', 11).style('fill', css('--muted')).text(compact(v)));
    svg.append('text').attr('x', lx + lw + 10).attr('y', ly + 8).attr('font-size', 12).style('fill', css('--muted')).text('import lines (log scale)');
    // table view
    $('#matrix-table').innerHTML = `<table><thead><tr><th>Importer ↓ / imported →</th>${M.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>` +
      M.rows.map((r, i) => `<tr><td>${esc(r)}</td>${M.values[i].map((v) => `<td>${full(v)}</td>`).join('')}</tr>`).join('') + '</tbody></table>';
  }

  /* ---------- depth profile (stacked columns) ---------- */
  function legendHtml(groups) { return groups.map((g) => `<span class="key">${swatch(g)}${esc(g)}</span>`).join(''); }
  function renderDepth() {
    const P = D.depth, el = $('#depth-chart'), W = el.clientWidth || 900, H = 300;
    const m = { t: 10, r: 10, b: 36, l: 52 };
    const rows = P.rows.map((r) => { const o = { d: r[0] }; P.groups.forEach((g, i) => { o[g] = r[i + 1]; }); o.total = d3.sum(r.slice(1)); return o; });
    const x = d3.scaleBand().domain(rows.map((r) => r.d)).range([m.l, W - m.r]).paddingInner(0);
    const y = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.total)]).nice().range([H - m.b, m.t]);
    const stack = d3.stack().keys(P.groups)(rows);
    el.innerHTML = '';
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
      .attr('aria-label', 'Stacked columns of module counts by import depth and library; the table view below lists every value.');
    svg.append('g').attr('class', 'grid').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat(''));
    svg.append('g').attr('class', 'axis').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat((v) => compact(v)).tickSizeOuter(0));
    svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - m.b})`)
      .call(d3.axisBottom(x).tickValues(rows.map((r) => r.d).filter((d) => d % 20 === 0)).tickSizeOuter(0));
    svg.append('text').attr('x', W - m.r).attr('y', H - 4).attr('text-anchor', 'end').attr('font-size', 12).style('fill', css('--muted')).text('depth below Main (import levels)');
    const bw = Math.max(1, x.bandwidth() - 1);
    stack.forEach((layer, li) => {
      svg.append('g').attr('fill', groupColor(P.groups[li])).selectAll('rect').data(layer).join('rect')
        .attr('x', (d) => x(d.data.d)).attr('width', bw)
        .attr('y', (d) => y(d[1]) + (y(d[0]) - y(d[1]) > 3 ? 1 : 0))
        .attr('height', (d) => Math.max(0, y(d[0]) - y(d[1]) - (y(d[0]) - y(d[1]) > 3 ? 1 : 0)));
    });
    const cross = svg.append('rect').attr('fill', css('--text-primary')).attr('opacity', 0).attr('width', 1).attr('y', m.t).attr('height', H - m.b - m.t);
    svg.append('g').selectAll('rect').data(rows).join('rect')
      .attr('x', (d) => x(d.d)).attr('width', x.bandwidth()).attr('y', m.t).attr('height', H - m.b - m.t).attr('fill', 'transparent')
      .on('mouseenter mousemove', function (ev, d) {
        cross.attr('x', x(d.d) + bw / 2).attr('opacity', 0.35);
        showTip(tipRows(`Depth ${d.d}`, [['All modules', full(d.total)]].concat(P.groups.filter((g) => d[g] > 0).map((g) => [`${swatch(g)} ${esc(g)}`, full(d[g])]))), ev, this);
      })
      .on('mouseleave', () => { cross.attr('opacity', 0); hideTip(); });
    $('#depth-legend').innerHTML = legendHtml(P.groups);
    $('#depth-table').innerHTML = `<table><thead><tr><th>Depth</th>${P.groups.map((g) => `<th>${esc(g)}</th>`).join('')}<th>Total</th></tr></thead><tbody>` +
      rows.map((r) => `<tr><td>${r.d}</td>${P.groups.map((g) => `<td>${full(r[g])}</td>`).join('')}<td>${full(r.total)}</td></tr>`).join('') + '</tbody></table>';
  }

  /* ---------- longest chain ---------- */
  let chainAll = false;
  function renderChain() {
    const C = D.chain;
    $('#chain-sub').innerHTML = `The longest path of imports below <code>Main</code>: ${C.length} modules, one block each, colored by library. Hover or focus a block to see the module.`;
    const used = GROUPS.filter((g) => C.some((c) => c[1] === g));
    $('#chain-legend').innerHTML = legendHtml(used);
    const strip = $('#chain-strip');
    strip.innerHTML = C.map((c, i) => `<button type="button" data-i="${i}" style="background:${groupColor(c[1])}" aria-label="Step ${i + 1}: ${esc(c[0])}"></button>`).join('');
    strip.querySelectorAll('button').forEach((b) => {
      const c = C[+b.dataset.i];
      const h = tipRows(`Step ${+b.dataset.i + 1} of ${C.length}`, [['Module', `<code>${esc(c[0])}</code>`], ['Library', esc(c[1])], ['Lines', full(c[2])], ['Theorems', full(c[3])]]);
      b.addEventListener('mouseenter', (ev) => showTip(h, ev, b)); b.addEventListener('mousemove', (ev) => showTip(h, ev, b));
      b.addEventListener('focus', (ev) => showTip(h, ev, b)); b.addEventListener('mouseleave', hideTip); b.addEventListener('blur', hideTip);
    });
    const li = (c, i) => `<li><span class="n">${i + 1}</span>${swatch(c[1])}<code>${esc(c[0])}</code></li>`;
    const list = $('#chain-list');
    if (chainAll || C.length <= 14) list.innerHTML = C.map(li).join('');
    else list.innerHTML = C.slice(0, 8).map(li).join('') +
      `<li class="gap"><button type="button" class="theme" id="chain-more">Show all ${C.length} steps</button></li>` +
      C.slice(-4).map((c, k) => li(c, C.length - 4 + k)).join('');
    const more = $('#chain-more'); if (more) more.addEventListener('click', () => { chainAll = true; renderChain(); });
  }

  /* ---------- import explorer ---------- */
  let EX = null, exPath = ['Main'];
  function renderExplorer() {
    if (!EX) return;
    const mods = EX.modules, cur = exPath[exPath.length - 1], m = mods[cur];
    const cr = $('#ex-crumbs');
    cr.innerHTML = exPath.map((n, i) => {
      const short = n.split('.').slice(-1)[0];
      return i === exPath.length - 1 ? `<span class="here" title="${esc(n)}">${esc(short)}</span>`
        : `<button type="button" data-i="${i}" title="${esc(n)}">${esc(short)}</button><span class="sep">›</span>`;
    }).join('');
    cr.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { exPath = exPath.slice(0, +b.dataset.i + 1); renderExplorer(); }));
    const kids = (m.i || []).map((n) => [n, mods[n]]).sort((a, b) => b[1].l - a[1].l);
    const maxL = d3.max(kids, (k) => k[1].l) || 1;
    const stats = [['Library', `${swatch(m.g)} ${esc(cur.split('.')[0])}`], ['Lines', full(m.l)], ['Theorems', full(m.t)], ['Definitions', full(m.d)],
      ['Depth below Main', full(m.z)], ['Project imports', full(kids.length)], ['Mathlib imports', full(m.x)]];
    let html = `<div class="mod-head"><code>${esc(cur)}</code></div><div class="mod-stats">${stats.map(([k, v]) => `<span>${k} <b>${v}</b></span>`).join('')}</div>`;
    if (!kids.length) html += `<p class="note">${m.x ? 'This module imports only Mathlib.' : 'This module has no imports.'}</p>`;
    else html += '<ul class="imports">' + kids.map(([n, k]) => {
      const inner = `${swatch(k.g)}<code>${esc(n)}</code><span class="meter" aria-hidden="true"><i style="width:${(100 * k.l) / maxL}%"></i></span><span class="num">${compact(k.l)} lines</span>`;
      return k.i ? `<li><button type="button" data-n="${esc(n)}" aria-label="Open ${esc(n)}">${inner}</button></li>`
        : `<li><div class="stub" title="Depth ${k.z}: beyond the explorer's ${EX.maxDepth} levels; ${k.n} project imports">${inner}</div></li>`;
    }).join('') + '</ul>';
    const deeper = kids.filter((k) => !k[1].i).length;
    if (deeper) html += `<p class="note" style="margin:10px 0 0">${deeper} of these imports sit deeper than ${EX.maxDepth} levels below <code>Main</code>, so they cannot be opened here.</p>`;
    $('#ex-body').innerHTML = html;
    $('#ex-body').querySelectorAll('button[data-n]').forEach((b) => b.addEventListener('click', () => { exPath.push(b.dataset.n); renderExplorer(); $('#explorer').scrollIntoView({ block: 'start' }); }));
  }
  function loadExplorer() {
    if (EX) return;
    fetch('data/explorer.json').then((r) => r.json()).then((j) => { EX = j; $('#ex-depth').textContent = j.maxDepth; renderExplorer(); })
      .catch(() => { $('#ex-body').innerHTML = '<p class="note">The explorer data could not be loaded.</p>'; });
  }
  new IntersectionObserver((es, o) => { if (es.some((e) => e.isIntersecting)) { loadExplorer(); o.disconnect(); } }, { rootMargin: '400px' }).observe($('#explorer'));

  /* ---------- most imported, Mathlib, checks ---------- */
  function shortName(n) { const p = n.split('.'); return p.length > 2 ? p.slice(-2).join('.') : n; }
  function renderFanin() {
    bars($('#fanin-chart'), D.fanin.map(([n, g, c]) => ({ label: shortName(n), value: c, swatch: g,
      tip: tipRows(`<code>${esc(n)}</code>`, [['Library', esc(g)], ['Imported by', `${full(c)} modules`]]) })), { labelW: 340, fmt: full });
  }
  function renderMathlib() {
    const s = D.summary, named = s.mathlibDistinct - (s.mathlibWhole ? 1 : 0);
    $('#mathlib-sub').innerHTML = `${full(s.mathlibWhole)} of the ${full(s.modules)} modules start with <code>import Mathlib</code>, which brings in the whole library. Beyond that, project files import ${full(named)} Mathlib modules by name. Mathlib is pinned to commit <code>0df444a</code>.`;
    $('#mathlib-kpis').innerHTML = [['Modules importing all of Mathlib', compact(s.mathlibWhole), `${pct(s.mathlibWhole, s.modules)} of all modules`],
      ['Mathlib modules imported by name', full(named), 'besides the whole library'], ['Lean toolchain', 'v4.33.1', 'leanprover/lean4']]
      .map(([l, v, n]) => `<div class="kpi"><div class="k-label">${l}</div><div class="k-value">${v}</div><div class="k-note">${n}</div></div>`).join('');
    bars($('#mathlib-chart'), s.mathlibTop.map(([n, c]) => ({ label: n.replace(/^Mathlib\./, ''), value: c,
      tip: tipRows(`<code>${esc(n)}</code>`, [['Imported by', `${full(c)} modules`]]) })), { labelW: 420, fmt: full });
  }
  const HATCH_INFO = {
    sorry: ['sorry', 'A placeholder that skips a proof'], admit: ['admit', 'Same effect as sorry'],
    axiom: ['axiom', 'Declares a new axiom'], native_decide: ['native_decide', 'Trusts compiled code to decide a proposition'],
    implemented_by: ['@[implemented_by]', 'Swaps in different compiled code for a definition'], extern: ['@[extern]', 'Links a definition to external code'],
    unsafe: ['unsafe', 'Marks code the kernel does not check'], skipKernelTC: ['debug.skipKernelTC', 'Turns off kernel type checking'],
  };
  const CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4.8 8.3l2.1 2.1 4.3-4.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function renderChecks() {
    $('#checks-body').innerHTML = Object.entries(D.summary.hatches).map(([k, v]) => {
      const [kw, what] = HATCH_INFO[k] || [k, ''];
      const status = v === 0 ? `<span class="status-good">${CHECK}None found</span>` : `<b>${full(v)}</b>`;
      return `<tr><td><code>${esc(kw)}</code></td><td>${esc(what)}</td><td>${status}</td></tr>`;
    }).join('');
  }

  /* ---------- boot ---------- */
  function renderAll() {
    if (!D.summary) return;
    renderKpis(); renderTree(); renderMatrix(); renderDepth(); renderChain(); renderFanin(); renderMathlib(); renderChecks(); renderExplorer();
  }
  const files = ['summary', 'tree', 'matrix', 'depth', 'chain', 'fanin'];
  Promise.all(files.map((f) => fetch(`data/${f}.json`).then((r) => r.json()))).then((arr) => {
    files.forEach((f, i) => { D[f] = arr[i]; });
    GROUPS = D.summary.groups;
    treePath = [D.tree];
    renderAll();
  }).catch((e) => { $('#kpis').innerHTML = `<p class="loading">Could not load the data: ${esc(e.message)}</p>`; });
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { renderTree(); renderMatrix(); renderDepth(); renderFanin(); renderMathlib(); }, 150); });
})();
