/* Shared card content — identical across every design-language demo
   so the only variable is the visual language itself. */
window.DEMO = {
  kicker: '第 042 期 · 饮品图鉴',
  title: '宇字辈饮料大全',
  seal: '已集\n12/16',
  carousel: [
    { emoji: '🌀', name: '宇宙摩打气泡水', note: '海盐荔枝 · 限定罐', rate: '4.5' },
    { emoji: '🍵', name: '宇治抹茶鲜奶', note: '石臼一番 · 微糖', rate: '4.8' },
    { emoji: '🚀', name: '宇航员冰美式', note: '深烘 · 加浓双份', rate: '4.2' },
  ],
  chips: ['全部', '碳酸派', '茶饮派', '咖啡派', '地方派'],
  radio: ['按甜度', '按气泡', '按年代'],
  list: [
    { emoji: '🫧', title: '宇部碳酸 · 蓝罐', note: '山口县限定 · 直输', tags: ['地方派', '气泡 ★5'], dots: 5 },
    { emoji: '🍡', title: '宇宙团子奶茶', note: '黑糖珍珠 · 三分甜', tags: ['茶饮派'], dots: 4 },
  ],
  extra: [
    { emoji: '🧊', title: '宇eo 冰滴茶', note: '冷萃 12 小时', tags: ['茶饮派'], dots: 4 },
    { emoji: '🥤', title: '宇航可乐 · 樱花版', note: '春季限定 · 少气泡', tags: ['碳酸派'], dots: 3 },
  ],
  progress: { cur: 12, total: 16, label: '集章进度', cta: '盖章下一枚' },
};

window.mountDemo = function (root) {
  const D = window.DEMO;
  root.innerHTML = `
    <div class="card">
      <header class="hd">
        <div class="hd-main">
          <div class="k">${D.kicker}</div>
          <h1 class="ttl">${D.title}</h1>
        </div>
        <div class="seal">${D.seal.replace('\n', '<br>')}</div>
      </header>

      <div class="car">
        ${D.carousel.map((c) => `
          <div class="car-item">
            <div class="ph"><span class="emoji">${c.emoji}</span></div>
            <div class="car-head"><span class="car-name">${c.name}</span><span class="car-rate">★ ${c.rate}</span></div>
            <div class="car-note">${c.note}</div>
          </div>`).join('')}
      </div>
      <div class="car-dots">${D.carousel.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>

      <div class="chips">
        ${D.chips.map((c, i) => `<button class="chip ${i === 0 ? 'on' : ''}">${c}</button>`).join('')}
      </div>

      <div class="radio">
        ${D.radio.map((r, i) => `<button class="opt ${i === 0 ? 'on' : ''}">${r}</button>`).join('')}
      </div>

      <div class="list">
        ${D.list.map((it) => `
          <div class="item">
            <div class="thumb"><span class="emoji">${it.emoji}</span></div>
            <div class="meta">
              <div class="it-title">${it.title}</div>
              <div class="it-note">${it.note}</div>
              <div class="tags">${it.tags.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
            </div>
            <div class="rate">${Array.from({ length: 5 }, (_, d) =>
              `<span class="dot ${d < it.dots ? 'on' : ''}"></span>`).join('')}</div>
          </div>`).join('')}
      </div>

      <footer class="ft">
        <div class="prog">
          <div class="prog-label"><span>${D.progress.label}</span><span class="prog-num">${D.progress.cur}/${D.progress.total}</span></div>
          <div class="bar"><div class="bar-fill"></div></div>
        </div>
        <button class="btn">${D.progress.cta}</button>
      </footer>
    </div>`;
};
