(function () {
  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  var hero = document.getElementById('hero');
  var canvas = document.getElementById('graph');
  var ctx = canvas.getContext('2d');
  var statusEl = document.getElementById('status');
  var themeBtn = document.getElementById('theme');

  var HOP = 85;
  var FADE = 2600;
  var W = 0, H = 0, dpr = 1;
  var nodes = [], edges = [], adj = [], waves = [];
  var G = new Float32Array(0), T = new Float32Array(0);
  var colors = { node: [15, 27, 51], a: [51, 72, 255], b: [232, 51, 109] };
  var pointer = { x: -1e4, y: -1e4 };
  var visible = true;
  var raf = 0;

  function hex(h) {
    h = h.trim().replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function readColors() {
    var s = getComputedStyle(root);
    colors = {
      node: hex(s.getPropertyValue('--node')),
      a: hex(s.getPropertyValue('--wave-a')),
      b: hex(s.getPropertyValue('--wave-b'))
    };
  }
  function rgba(c, a) {
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
  }
  function mix(t) {
    var a = colors.a, b = colors.b;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function hop() { return reduced.matches ? 0 : HOP; }
  function glow(age) {
    if (age < 0) return 0;
    if (reduced.matches) return 0.9;
    var rise = Math.min(age / 140, 1);
    var fall = Math.max(0, 1 - age / FADE);
    return rise * fall * fall;
  }

  function size() {
    var r = hero.getBoundingClientRect();
    W = Math.round(r.width);
    H = Math.round(r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function build() {
    size();
    var count = Math.max(34, Math.min(130, Math.round(W * H / 9500)));
    var cell = Math.sqrt(W * H / count);
    var cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
    nodes = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var bx = (c + 0.5 + (Math.random() - 0.5) * 0.7) * cell;
        var by = (r + 0.5 + (Math.random() - 0.5) * 0.7) * cell;
        if (bx < 6 || bx > W - 6 || by < 6 || by > H - 6) continue;
        nodes.push({ bx: bx, by: by, x: bx, y: by, ox: 0, oy: 0, ph: Math.random() * 6.283 });
      }
    }
    var n = nodes.length;
    adj = []; edges = [];
    for (var i = 0; i < n; i++) adj.push([]);
    var seen = new Set();
    var maxD = cell * 1.9;
    for (var i2 = 0; i2 < n; i2++) {
      var near = [];
      for (var j = 0; j < n; j++) {
        if (i2 === j) continue;
        var d = Math.hypot(nodes[i2].bx - nodes[j].bx, nodes[i2].by - nodes[j].by);
        if (d < maxD) near.push([d, j]);
      }
      near.sort(function (p, q) { return p[0] - q[0]; });
      near.slice(0, 3).forEach(function (pair) {
        var j2 = pair[1];
        var a = Math.min(i2, j2), b = Math.max(i2, j2), k = a * n + b;
        if (seen.has(k)) return;
        seen.add(k);
        edges.push([a, b]);
        adj[a].push(b);
        adj[b].push(a);
      });
    }
    G = new Float32Array(n);
    T = new Float32Array(n);
    waves = [];
  }

  function bfs(sources) {
    var d = new Int16Array(nodes.length).fill(-1);
    var q = [];
    sources.forEach(function (s) { d[s] = 0; q.push(s); });
    for (var h = 0; h < q.length; h++) {
      var u = q[h];
      for (var k = 0; k < adj[u].length; k++) {
        var v = adj[u][k];
        if (d[v] < 0) { d[v] = d[u] + 1; q.push(v); }
      }
    }
    var max = 0, reached = 0;
    for (var i = 0; i < d.length; i++) {
      if (d[i] >= 0) { reached++; if (d[i] > max) max = d[i]; }
    }
    return { d: d, max: max, reached: reached };
  }

  function run(sources) {
    var res = bfs(sources);
    waves.push({ d: res.d, max: Math.max(res.max, 1), t0: performance.now() });
    if (reduced.matches) waves = [waves[waves.length - 1]];
    else if (waves.length > 6) waves.shift();
    kick();
    return res;
  }

  function nearest(x, y) {
    var best = -1, bd = Infinity;
    for (var i = 0; i < nodes.length; i++) {
      var d = Math.hypot(nodes[i].x - x, nodes[i].y - y);
      if (d < bd) { bd = d; best = i; }
    }
    return { i: best, d: bd };
  }

  function frame(now) {
    ctx.clearRect(0, 0, W, H);
    var motion = !reduced.matches;
    var n = nodes.length;
    var h = hop();

    for (var i = 0; i < n; i++) {
      var nd = nodes[i];
      if (motion) {
        var tx = 0, ty = 0;
        var dx = nd.bx - pointer.x, dy = nd.by - pointer.y;
        var dist = Math.hypot(dx, dy);
        if (dist < 150 && dist > 0.1) {
          var f = (1 - dist / 150) * 26;
          tx = dx / dist * f;
          ty = dy / dist * f;
        }
        nd.ox += (tx - nd.ox) * 0.08;
        nd.oy += (ty - nd.oy) * 0.08;
        nd.x = nd.bx + nd.ox + Math.sin(now / 2600 + nd.ph) * 3;
        nd.y = nd.by + nd.oy + Math.cos(now / 3100 + nd.ph) * 3;
      } else {
        nd.x = nd.bx; nd.y = nd.by;
      }
    }

    for (var a = 0; a < n; a++) {
      var best = 0, bt = 0;
      for (var w = 0; w < waves.length; w++) {
        var di = waves[w].d[a];
        if (di < 0) continue;
        var gl = glow(now - (waves[w].t0 + di * h));
        if (gl > best) { best = gl; bt = di / waves[w].max; }
      }
      G[a] = best; T[a] = bt;
    }

    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(colors.node, 0.14);
    ctx.beginPath();
    for (var e = 0; e < edges.length; e++) {
      var p = nodes[edges[e][0]], q = nodes[edges[e][1]];
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();

    for (var w2 = 0; w2 < waves.length; w2++) {
      var wv = waves[w2];
      for (var e2 = 0; e2 < edges.length; e2++) {
        var ia = edges[e2][0], ib = edges[e2][1];
        var da = wv.d[ia], db = wv.d[ib];
        if (da < 0 || db < 0) continue;
        var pi = ia, qi = ib;
        if (da > db) { pi = ib; qi = ia; var tmp = da; da = db; db = tmp; }
        var age = now - (wv.t0 + da * h);
        if (age < 0) continue;
        var gl2 = glow(age);
        if (gl2 < 0.02) continue;
        var prog = (da === db || h === 0) ? 1 : Math.min(age / h, 1);
        var P = nodes[pi], Q = nodes[qi];
        ctx.strokeStyle = rgba(mix(db / wv.max), gl2 * 0.85);
        ctx.lineWidth = 1 + gl2 * 1.2;
        ctx.beginPath();
        ctx.moveTo(P.x, P.y);
        ctx.lineTo(P.x + (Q.x - P.x) * prog, P.y + (Q.y - P.y) * prog);
        ctx.stroke();
      }
    }

    for (var k = 0; k < n; k++) {
      var nk = nodes[k], g = G[k];
      if (g > 0.02) {
        var col = mix(T[k]);
        ctx.fillStyle = rgba(col, 0.25 + 0.75 * g);
        ctx.beginPath();
        ctx.arc(nk.x, nk.y, 2.2 + g * 4.5, 0, 6.283);
        ctx.fill();
        ctx.strokeStyle = rgba(col, g * 0.35);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(nk.x, nk.y, 2.2 + g * 13, 0, 6.283);
        ctx.stroke();
      } else {
        ctx.fillStyle = rgba(colors.node, 0.38);
        ctx.beginPath();
        ctx.arc(nk.x, nk.y, 2.2, 0, 6.283);
        ctx.fill();
      }
    }

    if (motion && pointer.x > -1000 && n) {
      var nr = nearest(pointer.x, pointer.y);
      if (nr.d < 90) {
        ctx.strokeStyle = rgba(colors.a, 0.7);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(nodes[nr.i].x, nodes[nr.i].y, 9, 0, 6.283);
        ctx.stroke();
      }
    }
  }

  function loop(now) {
    raf = 0;
    frame(now);
    if (visible && !reduced.matches && !document.hidden) raf = requestAnimationFrame(loop);
  }
  function kick() {
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function say(text) { statusEl.textContent = text; }
  function local(e) {
    var r = hero.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  hero.addEventListener('pointermove', function (e) {
    var p = local(e);
    pointer.x = p.x; pointer.y = p.y;
  });
  hero.addEventListener('pointerleave', function () { pointer.x = -1e4; pointer.y = -1e4; });
  hero.addEventListener('click', function (e) {
    if (e.target.closest('a, button')) return;
    var p = local(e);
    var s = nearest(p.x, p.y).i;
    if (s < 0) return;
    var res = run([s]);
    say('Search from node ' + (s + 1) + ' reached ' + res.reached + ' of ' + nodes.length + ' nodes in ' + res.max + ' steps.');
  });

  var resizeTimer = 0;
  new ResizeObserver(function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var r = hero.getBoundingClientRect();
      var dw = Math.abs(Math.round(r.width) - W), dh = Math.abs(Math.round(r.height) - H);
      if (dw > 1 || dh > H * 0.15) { build(); startIntro(); }
      else if (dw || dh) { size(); }
      kick();
    }, 150);
  }).observe(hero);

  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    if (visible) kick();
  }).observe(hero);
  document.addEventListener('visibilitychange', kick);
  reduced.addEventListener('change', function () { waves = []; kick(); });

  function startIntro() {
    if (!nodes.length) return;
    var spots = [[0.2, 0.35], [0.55, 0.7], [0.85, 0.3]];
    var src = [];
    spots.forEach(function (s) {
      var i = nearest(W * s[0], H * s[1]).i;
      if (src.indexOf(i) < 0) src.push(i);
    });
    run(src);
    say('A search from ' + src.length + ' nodes at once. Click or tap to start your own.');
  }

  /* theme */
  function effective() {
    return root.getAttribute('data-theme') || (darkQuery.matches ? 'dark' : 'light');
  }
  function syncTheme() {
    var dark = effective() === 'dark';
    themeBtn.textContent = dark ? 'Light' : 'Dark';
    themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    readColors();
    kick();
  }
  themeBtn.addEventListener('click', function () {
    var next = effective() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    syncTheme();
  });
  darkQuery.addEventListener('change', syncTheme);

  /* work rows */
  document.querySelectorAll('.proj-head').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.proj');
      var open = item.getAttribute('data-open') === 'true';
      item.setAttribute('data-open', String(!open));
      btn.setAttribute('aria-expanded', String(!open));
    });
  });

  readColors();
  syncTheme();
  build();
  kick();
  setTimeout(startIntro, 350);
})();
