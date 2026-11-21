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
        const base = d3.color(r.muted ? css('--other') : css('--s1')), ex = 7, ey = -6, x0 = labelW, x1 = labelW + w, y1 = y0 + barH;
        const bar = s.append('g').attr('class', 'bar');
        bar.append('path').attr('fill', base.brighter(0.55)).attr('d', `M${x0},${y0}L${x0 + ex},${y0 + ey}L${x1 + ex},${y0 + ey}L${x1},${y0}z`);
        bar.append('path').attr('fill', base.darker(0.7)).attr('d', `M${x1},${y0}L${x1 + ex},${y0 + ey}L${x1 + ex},${y1 + ey}L${x1},${y1}z`);
        bar.append('rect').attr('x', x0).attr('y', y0).attr('width', w).attr('height', barH).attr('fill', base);
      }
      s.append('text').attr('x', labelW + w + 14).attr('y', rowH / 2 + 3).attr('font-size', 12)
        .style('font-variant-numeric', 'tabular-nums').style('fill', css('--text-secondary')).text(opt.fmt ? opt.fmt(r.value) : compact(r.value));
    });
    g.on('mouseenter mousemove focus', function (ev, r) { if (r.tip) showTip(r.tip, ev, this); })
      .on('mouseleave blur', hideTip)
      .on('click', (ev, r) => { if (r.onClick) { hideTip(); r.onClick(); } })
      .on('keydown', (ev, r) => { if (r.onClick && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); hideTip(); r.onClick(); } });
  }

  /* ---------- hero field: one dot per module, by import depth ---------- */
  const FIELD = ['#4f9bf5', '#f0733f', '#25c08a', '#e0a020', '#ea6c9c', '#35c235', '#9a9992'];
  function drawCosmos2D() {
    const cv = $('#cosmos'); if (!cv || !D.depth) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H);
    const rows = D.depth.rows, groups = D.depth.groups, maxD = rows[rows.length - 1][0];
    const totals = rows.map((r) => d3.sum(r.slice(1))), maxN = d3.max(totals);
    const pad = Math.max(28, W * 0.06), span = W - 2 * pad, colW = span / maxD, mid = H / 2, hmax = H * 0.44;
    const x = (d) => pad + (d / maxD) * span;
    let seed = 20261120;
    const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.72;
    rows.forEach((r, i) => {
      const h = Math.max(2, Math.sqrt(totals[i] / maxN) * hmax), cx = x(r[0]);
      for (let g = 0; g < groups.length; g++) {
        ctx.fillStyle = FIELD[g];
        for (let k = 0; k < r[g + 1]; k++) {
          const u = ((rnd() + rnd() + rnd()) / 3) * 2 - 1;
          ctx.fillRect(cx + (rnd() - 0.5) * colW * 1.8, mid + u * h * 1.5, 1.25, 1.25);
        }
      }
    });
    ctx.globalAlpha = 1;
    const glow = ctx.createRadialGradient(x(0), mid, 0, x(0), mid, 34);
    glow.addColorStop(0, 'rgba(255,236,180,0.95)'); glow.addColorStop(0.25, 'rgba(216,187,114,0.55)'); glow.addColorStop(1, 'rgba(216,187,114,0)');
    ctx.fillStyle = glow; ctx.fillRect(x(0) - 34, mid - 34, 68, 68);
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = '12px system-ui, -apple-system, "Segoe UI", sans-serif'; ctx.fillStyle = '#c3c2b7';
    ctx.textAlign = 'left'; ctx.fillText('Main', x(0) - 14, mid + 52);
    ctx.textAlign = 'right'; ctx.fillText(`depth ${maxD}`, W - pad + 14, mid + 52);
    cv.classList.add('on');
  }


  /* 3D version: the same dots as a rotating volume, drawn with WebGL; falls back to the flat drawing. */
  const VS = `attribute vec3 p; attribute vec3 c; attribute float sz;
    uniform float rot, yaw, pitch, aspect, dpr; varying vec3 vc; varying float va;
    void main(){
      float cr = cos(rot), sr = sin(rot);
      vec3 q = vec3(p.x, p.y*cr - p.z*sr, p.y*sr + p.z*cr);
      float cy = cos(yaw), sy = sin(yaw);
      q = vec3(q.x*cy + q.z*sy, q.y, -q.x*sy + q.z*cy);
      float cp = cos(pitch), sp = sin(pitch);
      q = vec3(q.x, q.y*cp - q.z*sp, q.y*sp + q.z*cp);
      float k = 2.6 / (2.6 - q.z);
      gl_Position = vec4(q.x*0.86*k + 0.03, q.y*aspect*0.86*k + 0.14, 0.0, 1.0);
      gl_PointSize = sz * dpr * k;
      vc = c; va = clamp(0.35 + 0.65*k*k*0.6, 0.25, 1.0);
    }`;
  const FS = `precision mediump float; varying vec3 vc; varying float va;
    void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d)*2.0; if (r > 1.0) discard;
      float a = (1.0 - r*r) * 0.46; gl_FragColor = vec4(vc*a*va, a*va); }`;
  const TILT_YAW = 0.42, TILT_PITCH = 0.24;   // resting pose: near end toward the viewer, far end rising
  let cosmos = null;
  function hex3(h) { const c = d3.rgb(h); return [c.r / 255, c.g / 255, c.b / 255]; }
  function initCosmos3D(cv) {
    const gl = cv.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true });
    if (!gl) return null;
    const sh = (t, src) => { const o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; };
    const v = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, FS); if (!v || !f) return null;
    const prog = gl.createProgram(); gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    const rows = D.depth.rows, groups = D.depth.groups, maxD = rows[rows.length - 1][0];
    const totals = rows.map((r) => d3.sum(r.slice(1))), maxN = d3.max(totals), N = d3.sum(totals) + 1;
    const buf = new Float32Array(N * 7), cols = FIELD.map(hex3);
    let seed = 20261120, o = 0;
    const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    rows.forEach((r, i) => {
      const h = Math.max(0.006, Math.sqrt(totals[i] / maxN) * 0.27), cx = -1 + 2 * r[0] / maxD;
      for (let g = 0; g < groups.length; g++) for (let k = 0; k < r[g + 1]; k++) {
        const rad = h * Math.sqrt(rnd()) * (0.75 + 0.5 * rnd()), th = rnd() * 6.2831853;
        buf[o++] = cx + (rnd() - 0.5) * 2.4 / maxD; buf[o++] = rad * Math.cos(th); buf[o++] = rad * Math.sin(th);
        buf[o++] = cols[g][0]; buf[o++] = cols[g][1]; buf[o++] = cols[g][2]; buf[o++] = 1.5 + rnd() * 1.0;
      }
    });
    buf.set([-1, 0, 0, 3.0, 2.5, 1.5, 46], o);   // Main, the glowing point at the left end
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
    gl.useProgram(prog);
    [['p', 3, 0], ['c', 3, 12], ['sz', 1, 24]].forEach(([n, size, off]) => { const l = gl.getAttribLocation(prog, n); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 28, off); });
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.clearColor(0, 0, 0, 0);
    const U = {}; ['rot', 'yaw', 'pitch', 'aspect', 'dpr'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
    const st = { gl, U, N, rot: 0, yaw: TILT_YAW, pitch: TILT_PITCH, tyaw: TILT_YAW, tpitch: TILT_PITCH, visible: true, still: matchMedia('(prefers-reduced-motion: reduce)').matches, last: 0 };
    st.frame = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      gl.viewport(0, 0, cv.width, cv.height); gl.clear(gl.COLOR_BUFFER_BIT);
      st.yaw += (st.tyaw - st.yaw) * 0.06; st.pitch += (st.tpitch - st.pitch) * 0.06;
      gl.uniform1f(U.rot, st.rot); gl.uniform1f(U.yaw, st.yaw); gl.uniform1f(U.pitch, st.pitch); gl.uniform1f(U.aspect, W / H); gl.uniform1f(U.dpr, dpr);
      gl.drawArrays(gl.POINTS, 0, N);
    };
    const loop = (now) => { if (st.visible && !st.still) { st.rot += Math.min(50, now - (st.last || now)) * 0.00016; st.frame(); } st.last = now; requestAnimationFrame(loop); };
    const hero = cv.closest('.grand');
    hero.addEventListener('pointermove', (ev) => { const b = hero.getBoundingClientRect(); st.tyaw = TILT_YAW + ((ev.clientX - b.left) / b.width - 0.5) * 0.9; st.tpitch = TILT_PITCH + ((ev.clientY - b.top) / b.height - 0.5) * 0.5; if (st.still) st.frame(); });
    hero.addEventListener('pointerleave', () => { st.tyaw = TILT_YAW; st.tpitch = TILT_PITCH; });
    new IntersectionObserver((es) => { st.visible = es[0].isIntersecting; }).observe(cv);
    st.frame(); requestAnimationFrame(loop);
    return st;
  }
  function drawCosmos() {
    const cv = $('#cosmos'); if (!cv || !D.depth) return;
    if (cosmos === null) { try { cosmos = initCosmos3D(cv) || false; } catch (e) { cosmos = false; } }
    if (cosmos) { cosmos.frame(); cv.classList.add('on'); } else drawCosmos2D();
  }

  /* ---------- tilt and reveal ---------- */
  const motionOK = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  function tilt(sel) {
    if (!motionOK) return;
    document.querySelectorAll(sel).forEach((el) => {
      if (el.dataset.tilt) return; el.dataset.tilt = 1;
      el.addEventListener('pointermove', (ev) => { const b = el.getBoundingClientRect(), x = (ev.clientX - b.left) / b.width - 0.5, y = (ev.clientY - b.top) / b.height - 0.5;
        el.style.transform = `perspective(700px) rotateX(${(-y * 10).toFixed(2)}deg) rotateY(${(x * 12).toFixed(2)}deg) translateZ(8px)`; });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }
  if (motionOK) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('section.block, .finale .wrap, .ages li').forEach((el) => { el.classList.add('reveal'); io.observe(el); });
  }

  /* ---------- key figures ---------- */
  let kpiAnimated = false;
  function renderKpis() {
    const s = D.summary, h = Object.values(s.hatches).reduce((a, b) => a + b, 0);
    const k = [
      ['Lean modules', compact(s.modules), `${full(s.modules)} files under src/`],
      ['Lines of Lean', compact(s.lines), `about ${full(Math.round(s.lines / 50 / 1000) * 1000)} pages at 50 lines a page`],
      ['Theorems and lemmas', compact(s.theorems), `${full(s.theorems)} declarations`],
      ['Definitions', compact(s.definitions), `def and abbrev, ${full(s.definitions)}`],
      ['Longest import chain', full(s.longestChain), 'modules, from Main down'],
      ['Escape hatches found', full(h), 'sorry, axiom, native_decide, …'],
    ];
    $('#kpis').innerHTML = k.map(([l, v, n]) => `<div class="kpi"><div class="k-label">${l}</div><div class="k-value">${v}</div><div class="k-note">${esc(n)}</div></div>`).join('');
    tilt('.kpi');
    if (!kpiAnimated && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      kpiAnimated = true;
      const targets = [s.modules, s.lines, s.theorems, s.definitions, s.longestChain, h], fmts = [compact, compact, compact, compact, full, full];
      const els = [...document.querySelectorAll('#kpis .k-value')], t0 = performance.now(), DUR = 1400;
      const step = (now) => {
        const p = Math.min(1, (now - t0) / DUR), e = 1 - Math.pow(1 - p, 3);
        els.forEach((el, i) => { el.textContent = fmts[i](Math.round(targets[i] * e)); });
        if (p < 1) requestAnimationFrame(step); else els.forEach((el, i) => { el.textContent = k[i][1]; });
      };
      requestAnimationFrame(step);
      setTimeout(() => els.forEach((el, i) => { el.textContent = k[i][1]; }), DUR + 200);   // settle even if frames are throttled
    }
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

  /* ---------- 3D canvases: shared helpers ---------- */
  const S3 = {}, anim = {}, animKey = new WeakMap();
  const animIO = new IntersectionObserver((es) => es.forEach((e) => { const k = animKey.get(e.target); if (k && anim[k]) anim[k].vis = e.isIntersecting; }));
  function canvas3(el, key, height, label) {
    el.querySelectorAll('canvas').forEach((c) => c.remove());
    const W = el.clientWidth || 900, H = typeof height === 'function' ? height(W) : height, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cv = document.createElement('canvas');
    cv.width = W * dpr; cv.height = H * dpr; cv.style.cssText = `display:block;width:100%;height:${H}px;touch-action:pan-y`;
    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', label);
    el.prepend(cv);
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    animKey.set(cv, key); animIO.observe(cv);
    return { cv, ctx, W, H };
  }
  function pos(cv, ev) { const b = cv.getBoundingClientRect(); return [ev.clientX - b.left, ev.clientY - b.top]; }
  function inPoly(pt, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
  function fillPoly(ctx, pts, fill, stroke) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); } }
  if (motionOK) { const tick = (now) => { Object.values(anim).forEach((a) => { if (a.vis) a.fn(now); }); requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
  function legendHtml(groups) { return groups.map((g) => `<span class="key">${swatch(g)}${esc(g)}</span>`).join(''); }

  /* ---------- library matrix: a 3D skyline ---------- */
  function renderMatrix() {
    const M = D.matrix, el = $('#matrix-chart'), R = M.rows.length, C = M.cols.length;
    const { cv, ctx, W, H } = canvas3(el, 'matrix', (w) => Math.max(360, Math.min(600, w * 0.56)), 'Three-dimensional skyline of import counts between libraries; the table view below lists every value.');
    const st = S3.matrix || (S3.matrix = { yaw: 0.62, pitch: 0.6, hover: null, drag: null });
    const max = d3.max(M.values.flat()), ramp = css('--seq').split(',').map((x) => x.trim());
    const t = d3.scaleLog().domain([1, max]).range([0, 1]).clamp(true), color = (v) => d3.interpolateRgbBasis(ramp)(t(v));
    const ink = css('--text-secondary'), inkP = css('--text-primary'), surf = css('--surface-1'), flat = css('--surface-2');
    const narrow = W < 640, unit = Math.min(W / (C * 0.98 + R * 0.72 + (narrow ? 1 : 3.5)), H / 10.2);
    const draw = (now) => {
      const yaw = st.yaw + (motionOK && !st.drag && !st.hover ? Math.sin(now / 2600) * 0.07 : 0), sn = Math.sin(yaw), cs = Math.cos(yaw), sp = Math.sin(st.pitch), cp = Math.cos(st.pitch);
      const cx = W / 2 + unit * (narrow ? 0.6 : 1.1), cy = H * 0.5;
      const P = (x, y, z) => { const x1 = x * cs + z * sn, z1 = -x * sn + z * cs; return [cx + x1 * unit, cy - (y * cp - z1 * sp) * unit, y * sp + z1 * cp]; };
      ctx.clearRect(0, 0, W, H); ctx.lineWidth = 0.7; ctx.lineJoin = 'round';
      const boxes = [];
      for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
        const v = M.values[i][j], h = v > 0 ? 0.3 + 3.3 * t(v) : 0.05, x0 = j - C / 2 + 0.11, x1 = x0 + 0.78, z0 = i - R / 2 + 0.11, z1 = z0 + 0.78;
        boxes.push({ i, j, v, h, x0, x1, z0, z1, d: P((x0 + x1) / 2, 0, (z0 + z1) / 2)[2] });
      }
      boxes.sort((a, b) => a.d - b.d);
      boxes.forEach((b) => {
        const base = d3.color(b.v > 0 ? color(b.v) : flat), { x0, x1, z0, z1, h } = b;
        fillPoly(ctx, [P(x0, 0, z0), P(x0, 0, z1), P(x0, h, z1), P(x0, h, z0)], base.darker(0.95), surf);
        fillPoly(ctx, [P(x0, 0, z1), P(x1, 0, z1), P(x1, h, z1), P(x0, h, z1)], base.darker(0.45), surf);
        b.top = [P(x0, h, z0), P(x1, h, z0), P(x1, h, z1), P(x0, h, z1)];
        const hot = st.hover && st.hover.i === b.i && st.hover.j === b.j;
        fillPoly(ctx, b.top, hot ? base.brighter(0.6) : base, hot ? inkP : surf);
      });
      st.boxes = boxes;
      ctx.font = `${narrow ? 10.5 : 12.5}px system-ui, -apple-system, "Segoe UI", sans-serif`; ctx.textBaseline = 'middle';
      M.rows.forEach((r, i) => { const p = P(-C / 2 - 0.3, 0, i - R / 2 + 0.5); ctx.textAlign = 'right'; ctx.fillStyle = st.hover && st.hover.i === i ? inkP : ink; ctx.fillText(narrow && r.length > 9 ? r.slice(0, 8) + '…' : r, p[0], p[1]); });
      M.cols.forEach((c, j) => { const p = P(j - C / 2 + 0.5, 0, R / 2 + 0.35); ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(0.95); ctx.textAlign = 'left'; ctx.fillStyle = st.hover && st.hover.j === j ? inkP : ink; ctx.fillText(narrow && c.length > 9 ? c.slice(0, 8) + '…' : c, 0, 0); ctx.restore(); });
    };
    anim.matrix = { fn: draw, vis: true }; draw(performance.now());
    const pick = (pt) => { const B = st.boxes || []; for (let k = B.length - 1; k >= 0; k--) if (inPoly(pt, B[k].top)) return B[k]; return null; };
    cv.style.cursor = 'grab';
    cv.addEventListener('pointerdown', (ev) => { st.drag = { x: ev.clientX, y: ev.clientY, yaw: st.yaw, pitch: st.pitch }; cv.setPointerCapture(ev.pointerId); cv.style.cursor = 'grabbing'; hideTip(); });
    cv.addEventListener('pointerup', () => { st.drag = null; cv.style.cursor = 'grab'; });
    cv.addEventListener('pointermove', (ev) => {
      if (st.drag) { st.yaw = Math.max(0.2, Math.min(1.2, st.drag.yaw + (ev.clientX - st.drag.x) * 0.006)); st.pitch = Math.max(0.3, Math.min(1.05, st.drag.pitch + (ev.clientY - st.drag.y) * 0.005)); draw(performance.now()); return; }
      const b = pick(pos(cv, ev)); st.hover = b ? { i: b.i, j: b.j } : null;
      if (b) showTip(tipRows(`${esc(M.rows[b.i])} → ${esc(M.cols[b.j])}`, [['Import lines', full(b.v)], [`Share of ${esc(M.rows[b.i])}'s imports`, pct(b.v, d3.sum(M.values[b.i]))]]), ev, cv); else hideTip();
      draw(performance.now());
    });
    cv.addEventListener('pointerleave', () => { st.hover = null; hideTip(); draw(performance.now()); });
    let lg = el.querySelector('.scale'); if (!lg) { lg = document.createElement('div'); lg.className = 'scale'; el.appendChild(lg); }
    lg.innerHTML = `<span>1</span><i style="background:linear-gradient(90deg,${ramp.join(',')})"></i><span>${compact(max)}</span><span class="what">import lines: height and color, log scale. Drag to turn.</span>`;
    $('#matrix-table').innerHTML = `<table><thead><tr><th>Importer ↓ / imported →</th>${M.cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>` +
      M.rows.map((r, i) => `<tr><td>${esc(r)}</td>${M.values[i].map((v) => `<td>${full(v)}</td>`).join('')}</tr>`).join('') + '</tbody></table>';
  }

  /* ---------- depth profile: one 3D ridge per library ---------- */
  function renderDepth() {
    const Pd = D.depth, el = $('#depth-chart'), G = Pd.groups.length, B = G - 1;
    const { cv, ctx, W, H } = canvas3(el, 'depth', (w) => (w < 640 ? 320 : 420), 'Three-dimensional ridges of module counts by import depth, one ridge per library; the table view below lists every value.');
    const st = S3.depth || (S3.depth = { px: 0, py: 0, hover: null });
    const rows = Pd.rows, maxD = rows[rows.length - 1][0], byD = new Map(rows.map((r) => [r[0], r]));
    const maxV = d3.max(rows, (r) => d3.max(r.slice(1))), narrow = W < 640;
    const m = { l: narrow ? 40 : 54, r: narrow ? 12 : 128, t: 12, b: 34 }, DX = narrow ? 9 : 17, DY = narrow ? 12 : 17;
    const plotW = W - m.l - m.r - (DX + 6) * B, plotH = H - m.t - m.b - (DY + 4) * B, hs = d3.scaleSqrt().domain([0, maxV]).range([0, plotH]);
    const ink = css('--muted'), grid = css('--grid'), inkP = css('--text-primary'), ink2 = css('--text-secondary');
    const draw = () => {
      const dx = DX + st.px * 12, dy = DY + st.py * 7;
      const X = (d, b) => m.l + (d / maxD) * plotW + b * dx, Y = (v, b) => H - m.b - b * dy - hs(v);
      ctx.clearRect(0, 0, W, H); ctx.lineJoin = 'round';
      fillPoly(ctx, [[X(0, 0), Y(0, 0)], [X(maxD, 0), Y(0, 0)], [X(maxD, B), Y(0, B)], [X(0, B), Y(0, B)]], css('--surface-2'));
      ctx.font = '11.5px system-ui, -apple-system, "Segoe UI", sans-serif'; ctx.lineWidth = 1; ctx.strokeStyle = grid; ctx.fillStyle = ink;
      [500, 1000, 2000, 4000].filter((v) => v <= maxV).forEach((v) => { ctx.beginPath(); ctx.moveTo(X(0, B), Y(v, B)); ctx.lineTo(X(maxD, B), Y(v, B)); ctx.stroke(); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(full(v), X(0, B) - 6, Y(v, B)); });
      for (let d = 0; d <= maxD; d += 20) { ctx.beginPath(); ctx.moveTo(X(d, 0), Y(0, 0)); ctx.lineTo(X(d, B), Y(0, B)); ctx.stroke(); ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(d, X(d, 0), Y(0, 0) + 6); }
      ctx.textAlign = 'right'; ctx.fillText('depth below Main', X(maxD, 0), Y(0, 0) + 20);
      Pd.groups.forEach((g, gi) => {
        const b = B - gi, base = d3.color(groupColor(g)), pts = rows.map((r) => [X(r[0], b), Y(r[gi + 1], b)]);
        const face = [[X(0, b), Y(0, b)]].concat(pts, [[X(maxD, b), Y(0, b)]]), ox = dx * 0.42, oy = -dy * 0.42;
        fillPoly(ctx, face.map((p) => [p[0] + ox, p[1] + oy]), base.darker(0.9));
        const gr = ctx.createLinearGradient(0, Y(maxV, b), 0, Y(0, b)); gr.addColorStop(0, base.brighter(0.5)); gr.addColorStop(1, base);
        fillPoly(ctx, face, gr);
        ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.strokeStyle = base.brighter(1.1); ctx.lineWidth = 1.2; ctx.stroke();
        if (!narrow) { ctx.fillStyle = ink2; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(g, X(maxD, b) + 10, Y(0, b) - 3); }
      });
      if (st.hover != null) {
        const d = st.hover, r = byD.get(d); ctx.strokeStyle = inkP; ctx.globalAlpha = 0.5; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(d, 0), Y(0, 0)); ctx.lineTo(X(d, B), Y(0, B)); ctx.stroke(); ctx.globalAlpha = 1;
        if (r) Pd.groups.forEach((g, gi) => { const b = B - gi; if (!r[gi + 1]) return; ctx.beginPath(); ctx.arc(X(d, b), Y(r[gi + 1], b), 4, 0, 6.2832); ctx.fillStyle = groupColor(g); ctx.fill(); ctx.strokeStyle = css('--surface-1'); ctx.lineWidth = 2; ctx.stroke(); });
      }
    };
    draw();
    cv.addEventListener('pointermove', (ev) => {
      const [mx, my] = pos(cv, ev); st.px = mx / W - 0.5; st.py = my / H - 0.5;
      const d = Math.max(0, Math.min(maxD, Math.round(((mx - m.l - (DX + st.px * 12) * 2) / plotW) * maxD))), r = byD.get(d); st.hover = d; draw();
      if (r) showTip(tipRows(`Depth ${d}`, [['All modules', full(d3.sum(r.slice(1)))]].concat(Pd.groups.map((g, gi) => [g, r[gi + 1]]).filter((x) => x[1] > 0).map(([g, v]) => [`${swatch(g)} ${esc(g)}`, full(v)]))), ev, cv);
    });
    cv.addEventListener('pointerleave', () => { st.hover = null; st.px = 0; st.py = 0; hideTip(); draw(); });
    $('#depth-legend').innerHTML = legendHtml(Pd.groups);
    $('#depth-table').innerHTML = `<table><thead><tr><th>Depth</th>${Pd.groups.map((g) => `<th>${esc(g)}</th>`).join('')}<th>Total</th></tr></thead><tbody>` +
      rows.map((r) => `<tr><td>${r[0]}</td>${r.slice(1).map((v) => `<td>${full(v)}</td>`).join('')}<td>${full(d3.sum(r.slice(1)))}</td></tr>`).join('') + '</tbody></table>';
  }

  /* ---------- longest chain: a turning helix ---------- */
  let chainAll = false;
  function renderChain() {
    const C = D.chain, n = C.length, el = $('#chain-3d');
    $('#chain-sub').innerHTML = `The longest path of imports below <code>Main</code>: ${n} modules, drawn as a helix with one bead per module, colored by library. Hover a bead to see the module.`;
    $('#chain-legend').innerHTML = legendHtml(GROUPS.filter((g) => C.some((c) => c[1] === g)));
    const { cv, ctx, W, H } = canvas3(el, 'chain', (w) => (w < 640 ? 210 : 300), `A helix of ${n} beads, one per module on the longest import chain; the list below names them.`);
    const st = S3.chain || (S3.chain = { rot: 0, hover: -1, last: 0 });
    const padX = W < 640 ? 22 : 46, amp = H / 2 - 30, turn = W < 640 ? 0.3 : 0.19;
    const draw = (now) => {
      if (motionOK && st.hover < 0) st.rot += Math.min(50, now - (st.last || now)) * 0.0007; st.last = now;
      ctx.clearRect(0, 0, W, H);
      const pts = C.map((c, i) => { const th = i * turn + st.rot, z = Math.sin(th), k = 3.2 / (3.2 - z); return { i, x: padX + (i / (n - 1)) * (W - 2 * padX), y: H / 2 + Math.cos(th) * amp * k * 0.82, z, k, g: c[1] }; });
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.strokeStyle = css('--axis'); ctx.lineWidth = 1; ctx.stroke();
      const surf = css('--surface-1');
      pts.slice().sort((a, b) => a.z - b.z).forEach((p) => {
        const r = (W < 640 ? 2.8 : 5) * p.k * (p.i === st.hover ? 1.7 : 1);
        ctx.globalAlpha = p.i === st.hover ? 1 : 0.42 + 0.58 * (p.z + 1) / 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832); ctx.fillStyle = groupColor(p.g); ctx.fill();
        if (p.i === st.hover) { ctx.lineWidth = 2; ctx.strokeStyle = css('--text-primary'); ctx.stroke(); } else if (p.z > 0.2) { ctx.lineWidth = 1; ctx.strokeStyle = surf; ctx.stroke(); }
      });
      ctx.globalAlpha = 1; st.pts = pts;
      ctx.font = '12px system-ui, -apple-system, "Segoe UI", sans-serif'; ctx.fillStyle = css('--muted'); ctx.textBaseline = 'bottom';
      ctx.textAlign = 'left'; ctx.fillText('Main', padX - 14, H - 2); ctx.textAlign = 'right'; ctx.fillText(`step ${n}`, W - padX + 14, H - 2);
    };
    anim.chain = { fn: draw, vis: true }; draw(performance.now());
    cv.addEventListener('pointermove', (ev) => {
      const [mx, my] = pos(cv, ev); let best = -1, bd = 16 * 16;
      (st.pts || []).forEach((p) => { const d = (p.x - mx) ** 2 + (p.y - my) ** 2 - p.z * 20; if (d < bd) { bd = d; best = p.i; } });
      st.hover = best;
      if (best >= 0) { const c = C[best]; showTip(tipRows(`Step ${best + 1} of ${n}`, [['Module', `<code>${esc(c[0])}</code>`], ['Library', esc(c[1])], ['Lines', full(c[2])], ['Theorems', full(c[3])]]), ev, cv); } else hideTip();
      if (!motionOK) draw(performance.now());
    });
    cv.addEventListener('pointerleave', () => { st.hover = -1; hideTip(); if (!motionOK) draw(performance.now()); });
    const li = (c, i) => `<li><span class="n">${i + 1}</span>${swatch(c[1])}<code>${esc(c[0])}</code></li>`;
    const list = $('#chain-list');
    if (chainAll || n <= 14) list.innerHTML = C.map(li).join('');
    else list.innerHTML = C.slice(0, 8).map(li).join('') +
      `<li class="gap"><button type="button" class="theme" id="chain-more">Show all ${n} steps</button></li>` +
      C.slice(-4).map((c, k) => li(c, n - 4 + k)).join('');
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
    drawCosmos(); renderKpis(); renderTree(); renderMatrix(); renderDepth(); renderChain(); renderFanin(); renderMathlib(); renderChecks(); renderExplorer();
  }
  const files = ['summary', 'tree', 'matrix', 'depth', 'chain', 'fanin'];
  Promise.all(files.map((f) => fetch(`data/${f}.json`).then((r) => r.json()))).then((arr) => {
    files.forEach((f, i) => { D[f] = arr[i]; });
    GROUPS = D.summary.groups;
    treePath = [D.tree];
    renderAll();
  }).catch((e) => { $('#kpis').innerHTML = `<p class="loading">Could not load the data: ${esc(e.message)}</p>`; });
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { drawCosmos(); renderTree(); renderMatrix(); renderDepth(); renderChain(); renderFanin(); renderMathlib(); }, 150); });
})();
