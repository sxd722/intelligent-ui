/* ------------------------------------------------------------------
   mini auto-layout engine (demo of the final DIL host runtime duty)

   The MODEL never emits sizes. Given the same DSL, this engine derives
   every component's dimensions from:
     - the canvas (4:4 square side S)
     - content itself (text lengths, rating counts)
     - sibling counts (how many chips / carousel items / list rows)
     - parent-child context (carousel lives in header area vs list thumb)
   and then shrinks everything proportionally until the content fits
   the square without scrolling.
------------------------------------------------------------------- */
(function () {
  const stage = document.querySelector('.stage');
  const card = () => stage.querySelector('.card');

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function compute() {
    const r = stage.getBoundingClientRect();
    const S = Math.min(r.width, r.height);
    const t = parseFloat(stage.dataset.scale || '1');

    const chips = [...stage.querySelectorAll('.chip')];
    const nChips = chips.length;
    const chipText = chips.reduce((a, c) => a + c.textContent.length, 0);

    const nCar = stage.querySelectorAll('.car-item').length;
    const items = [...stage.querySelectorAll('.item')];
    const nList = items.length;
    const listText = items.reduce((a, i) => a + i.textContent.length, 0);

    // ---- canvas rhythm ----
    let u = {};
    u['--u-pad'] = S * 0.042 * t;
    u['--u-gap'] = S * 0.023 * t;
    u['--u-title'] = (S / 12.4) * t;
    u['--u-kick'] = (S / 40) * t;

    // ---- carousel: item size from sibling count (parent = hero strip);
    //      taller lists trade height away from the carousel ----
    const carTrade = nList >= 3 ? 0.84 : nList === 2 ? 1 : 1.1;
    u['--u-car-w'] = S * (nCar <= 2 ? 0.74 : nCar === 3 ? 0.58 : 0.46);
    u['--u-car-h'] = S * (nCar <= 2 ? 0.215 : 0.19) * carTrade;
    u['--u-car-fs'] = S / 33;
    u['--u-car-rate'] = S / 38;

    // ---- chips: font from count + total text; grow to fill row ----
    const chipFs = (S / 33) * clamp(1 - (chipText - 8) / 42, 0.7, 1) * t;
    u['--u-chip-fs'] = chipFs;
    u['--u-chip-px'] = chipFs * 1.15;
    u['--u-chip-py'] = chipFs * 0.42;
    u['--u-chip-gap'] = chipFs * 0.6;

    // ---- radio segmented ----
    u['--u-radio-fs'] = (S / 38) * t;
    u['--u-radio-h'] = S * 0.072;

    // ---- list rows: thumbs shrink as rows multiply; denser text → smaller ----
    const thumbBase = nList >= 4 ? 0.092 : nList === 3 ? 0.102 : 0.118;
    u['--u-thumb'] = S * clamp(thumbBase - listText / 2600, 0.082, 0.13);
    u['--u-list-fs'] = S / 29;
    u['--u-list-note'] = S / 34;
    u['--u-tag-fs'] = S / 42;
    u['--u-dot'] = S * 0.017;

    // ---- footer ----
    u['--u-bar'] = S * 0.016;
    u['--u-btn-h'] = S * 0.072;
    u['--u-btn-px'] = S * 0.048;
    u['--u-foot-fs'] = S / 41;

    return { u, S, nChips, nCar, nList, chipText };
  }

  // measure natural height with shrink disabled; then fit in priority
  // stages — whitespace absorbs first, fonts are touched last
  function fit() {
    const c = card();
    if (!c) return;
    const { u, S, nChips, nCar, nList } = compute();
    const f = {};
    const set = (k) => {
      for (const [key, val] of Object.entries(u)) {
        c.style.setProperty(key, `${val * (f[key] ?? 1) * (k ?? 1)}px`);
      }
    };
    c.classList.add('measuring');
    const over = () => c.scrollHeight - stage.clientHeight;

    set();
    const stages = [
      ['--u-gap', 0.78], ['--u-pad', 0.82], ['--u-car-h', 0.84],
      ['--u-thumb', 0.88], ['--u-car-h', 0.72], ['--u-gap', 0.68],
      ['--u-radio-h', 0.85], ['--u-btn-h', 0.85], ['--u-bar', 0.8],
    ];
    let used = 0;
    for (const [key, m] of stages) {
      if (over() > 1) { f[key] = (f[key] ?? 1) * m; set(); used++; }
    }
    let k = 1;
    if (over() > 1) {
      k = Math.max(0.62, (stage.clientHeight / c.scrollHeight) * 0.985);
    }
    c.classList.remove('measuring');
    set(k);
    updateReadout({ S, nChips, nCar, nList, k,
      chipFs: (u['--u-chip-fs'] * k).toFixed(1),
      carW: (u['--u-car-w'] * k).toFixed(0),
      carH: (u['--u-car-h'] * (f['--u-car-h'] ?? 1) * k).toFixed(0),
      thumb: (u['--u-thumb'] * (f['--u-thumb'] ?? 1) * k).toFixed(0),
      used,
    });
  }

  function updateReadout(d) {
    const ro = document.querySelector('.readout');
    if (!ro) return;
    ro.textContent =
      `engine ▸ square ${d.S.toFixed(0)}px · font-scale ×${d.k.toFixed(2)} · squeeze-stage ${d.used}/9\n` +
      `carousel: ${d.nCar} items → card ${d.carW}×${d.carH} · chips: ${d.nChips} → font ${d.chipFs}px\n` +
      `list: ${d.nList} rows → thumb ${d.thumb}px\n` +
      `whitespace absorbs overflow first; type scales last — sizes decided here, never by the model`;
  }

  function bind() {
    // palette switch
    document.querySelectorAll('[data-palette-btn]').forEach((b) => {
      b.addEventListener('click', () => {
        document.querySelectorAll('[data-palette-btn]').forEach((x) => x.removeAttribute('aria-pressed'));
        b.setAttribute('aria-pressed', 'true');
        stage.dataset.palette = b.dataset.paletteBtn;
      });
    });

    // density: add/remove a list row, engine refits
    const dens = document.querySelector('[data-density]');
    dens?.addEventListener('click', () => {
      const list = stage.querySelector('.list');
      const on = dens.getAttribute('aria-pressed') === 'true';
      if (!on) {
        const it = window.DEMO.extra[list.querySelectorAll('.item').length - window.DEMO.list.length];
        if (it) list.insertAdjacentHTML('beforeend', rowHTML(it));
        dens.setAttribute('aria-pressed', 'true');
      } else {
        const rows = list.querySelectorAll('.item');
        if (rows.length > window.DEMO.list.length) rows[rows.length - 1].remove();
        dens.setAttribute('aria-pressed', 'false');
      }
      fit();
    });

    // single-select groups
    stage.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (chip) {
        chip.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.remove('on'));
        chip.classList.add('on');
      }
      const opt = e.target.closest('.opt');
      if (opt) {
        opt.parentElement.querySelectorAll('.opt').forEach((o) => o.classList.remove('on'));
        opt.classList.add('on');
      }

      // stamp: advance collection progress
      const btn = e.target.closest('.btn');
      if (btn) {
        const P = window.DEMO.progress;
        if (P.cur < P.total) {
          P.cur += 1;
          stage.querySelector('.prog-num').textContent = `${P.cur}/${P.total}`;
          stage.querySelector('.bar-fill').style.width = `${(P.cur / P.total) * 100}%`;
          const seal = stage.querySelector('.seal');
          if (seal) seal.innerHTML = `已集<br>${P.cur}/${P.total}`;
          seal?.classList.remove('pulse');
          void seal?.offsetWidth;
          seal?.classList.add('pulse');
          if (P.cur === P.total) btn.textContent = '已集满';
        }
      }
    });

    // carousel dots follow scroll
    const car = stage.querySelector('.car');
    const dots = [...stage.querySelectorAll('.car-dots i')];
    let raf;
    car?.addEventListener('scroll', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = car.querySelector('.car-item').offsetWidth
          + parseFloat(getComputedStyle(car).gap || '12');
        const i = clamp(Math.round(car.scrollLeft / w), 0, dots.length - 1);
        dots.forEach((d, j) => d.classList.toggle('on', j === i));
      });
    }, { passive: true });
  }

  function rowHTML(it) {
    return `
      <div class="item">
        <div class="thumb"><span class="emoji">${it.emoji}</span></div>
        <div class="meta">
          <div class="it-title">${it.title}</div>
          <div class="it-note">${it.note}</div>
          <div class="tags">${it.tags.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
        </div>
        <div class="rate">${Array.from({ length: 5 }, (_, d) =>
          `<span class="dot ${d < it.dots ? 'on' : ''}"></span>`).join('')}</div>
      </div>`;
  }

  window.addEventListener('load', () => {
    window.mountDemo(stage);
    bind();
    fit();
    let r;
    window.addEventListener('resize', () => { cancelAnimationFrame(r); r = requestAnimationFrame(fit); });
    document.fonts?.ready?.then(fit);
  });
})();
