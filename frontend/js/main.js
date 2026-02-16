/* eslint-disable no-console */
// 暴露到全局作用域，供其他页面使用
window.STORAGE_KEYS = {
  favorites: "anyue_lemon:favorites",
};

window.getFavorites = function() {
  try {
    const raw = localStorage.getItem(window.STORAGE_KEYS.favorites);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
};

window.setFavorites = function(favs) {
  localStorage.setItem(window.STORAGE_KEYS.favorites, JSON.stringify([...favs]));
};

// 保持向后兼容
const STORAGE_KEYS = window.STORAGE_KEYS;
const getFavorites = window.getFavorites;
const setFavorites = window.setFavorites;

// 默认商品列表（本地写死，用作后端不可用时的兜底数据）
const PRODUCTS = [
  {
    id: "fresh-1",
    category: "fresh",
    tag: "鲜柠檬",
    title: "安岳鲜柠檬 · 精选大果",
    desc: "果皮细腻、汁水充足，适合日常泡水与烹饪。",
    price: 39.9,
    img: "https://images.unsplash.com/photo-1590502593747-42a996133562?auto=format&fit=crop&w=1400&q=70",
    taobaoUrl: "https://s.taobao.com/search?q=安岳柠檬精选大果",
  },
  {
    id: "processed-1",
    category: "processed",
    tag: "深加工品",
    title: "柠檬蜂蜜 · 冷泡更香",
    desc: "酸甜平衡，冷泡/热饮皆宜，解腻清爽。",
    price: 29.9,
    img: "https://images.unsplash.com/photo-1542444459-db47a4a3fdc0?auto=format&fit=crop&w=1400&q=70",
    taobaoUrl: "https://s.taobao.com/search?q=柠檬蜂蜜",
  },
  {
    id: "cultural-1",
    category: "cultural",
    tag: "石窟文创",
    title: "石窟纹样 · 帆布袋",
    desc: "将安岳石刻元素融入日常，简洁耐用。",
    price: 49.0,
    img: "https://images.unsplash.com/photo-1520975958225-72ac0c67a955?auto=format&fit=crop&w=1400&q=70",
    taobaoUrl: "https://s.taobao.com/search?q=石窟纹样帆布袋",
  },
  {
    id: "fresh-2",
    category: "fresh",
    tag: "鲜柠檬",
    title: "安岳鲜柠檬 · 家庭装",
    desc: "日常囤货更划算，适合榨汁、烘焙与调味。",
    price: 59.9,
    img: "https://images.unsplash.com/photo-1513612254504-6b9732b0f1a8?auto=format&fit=crop&w=1400&q=70",
    taobaoUrl: "https://s.taobao.com/search?q=安岳柠檬家庭装",
  },
  {
    id: "processed-2",
    category: "processed",
    tag: "深加工品",
    title: "柠檬片 · 低温烘焙",
    desc: "保留香气与口感，冷热泡皆可。",
    price: 19.9,
    img: "https://images.unsplash.com/photo-1528826194825-1f87545a4c74?auto=format&fit=crop&w=1400&q=70",
    taobaoUrl: "https://s.taobao.com/search?q=柠檬片低温烘焙",
  },
  {
    id: "cultural-2",
    category: "cultural",
    tag: "石窟文创",
    title: "佛光纹样 · 书签套装",
    desc: "纸感温润，礼赠与自用皆宜。",
    price: 18.8,
    img: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1400&q=70",
    taobaoUrl: "https://s.taobao.com/search?q=书签套装文创",
  },
];

// 从后端获取的商品列表（优先使用）
let productsFromServer = [];

// 暴露到全局
window.PRODUCTS = PRODUCTS;
window.productsFromServer = productsFromServer;

window.formatPrice = function(n) {
  return `¥${Number(n).toFixed(1)}`;
};

// 保持向后兼容
const formatPrice = window.formatPrice;

function qs(sel) {
  return document.querySelector(sel);
}

function qsa(sel) {
  return [...document.querySelectorAll(sel)];
}

function renderProducts({ category, query }) {
  const grid = qs("#productGrid");
  const empty = qs("#emptyState");
  if (!grid) return;

  const favs = getFavorites();
  const q = (query || "").trim().toLowerCase();

  const source = productsFromServer && productsFromServer.length ? productsFromServer : PRODUCTS;

  const filtered = source.filter((p) => {
    const hitCategory = category === "all" ? true : p.category === category;
    const hitQuery = !q
      ? true
      : `${p.title} ${p.desc} ${p.tag}`.toLowerCase().includes(q);
    return hitCategory && hitQuery;
  });

  grid.innerHTML = filtered
    .map((p) => {
      const pressed = favs.has(p.id) ? "true" : "false";
      return `
        <article class="product" data-id="${p.id}">
          <div class="product__media">
            <img src="${p.img}" alt="${p.title}" loading="lazy" />
            <div class="product__tag">${p.tag}</div>
            <div class="product__fav" type="button" aria-label="收藏" aria-pressed="${pressed}">
              <span class="star-icon">${pressed === 'true' ? '★' : '☆'}</span>
              <span class="favorite-text">收藏</span>
            </div>
          </div>
          <div class="product__body">
            <h3 class="product__title">${p.title}</h3>
            <p class="product__desc">${p.desc}</p>
            <div class="product__meta">
              <div class="price">${formatPrice(p.price)}</div>
              <button class="btn" type="button" data-action="detail">探柠详情</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  empty.hidden = filtered.length !== 0;
}

function setupProductPage() {
  const grid = qs("#productGrid");
  if (!grid) return;

  let currentCategory = "all";
  let currentQuery = "";

  const input = qs("#productSearch");
  const tabs = qsa(".tab");

  function rerender() {
    renderProducts({ category: currentCategory, query: currentQuery });
  }

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach((b) => {
        b.classList.remove("tab--active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("tab--active");
      btn.setAttribute("aria-selected", "true");
      currentCategory = btn.dataset.category || "all";
      rerender();
    });
  });

  if (input) {
    input.addEventListener("input", (e) => {
      currentQuery = e.target.value || "";
      rerender();
    });
  }

  grid.addEventListener("click", (e) => {
      const favBtn = e.target.closest(".product__fav");
      const detailBtn = e.target.closest('button[data-action="detail"]');
      const card = e.target.closest(".product");
      if (!card) return;

      const id = card.getAttribute("data-id");
      if (!id) return;

      if (favBtn) {
        e.preventDefault();
        e.stopPropagation();
        const favs = getFavorites();
        const next = !(favBtn.getAttribute("aria-pressed") === "true");
        favBtn.setAttribute("aria-pressed", String(next));
        
        const starIcon = favBtn.querySelector('.star-icon');
        const favoriteText = favBtn.querySelector('.favorite-text');
        
        if (next) {
          favs.add(id);
          console.log('收藏商品:', id);
          console.log('当前收藏列表:', Array.from(favs));
          if (starIcon) starIcon.textContent = '★';
          if (favoriteText) favoriteText.textContent = '已收藏';
          // 触发自定义事件，通知其他页面更新
          window.dispatchEvent(new CustomEvent('favoritesUpdated', { detail: { productId: id, action: 'add' } }));
        } else {
          favs.delete(id);
          console.log('取消收藏商品:', id);
          console.log('当前收藏列表:', Array.from(favs));
          if (starIcon) starIcon.textContent = '☆';
          if (favoriteText) favoriteText.textContent = '收藏';
          // 触发自定义事件，通知其他页面更新
          window.dispatchEvent(new CustomEvent('favoritesUpdated', { detail: { productId: id, action: 'remove' } }));
        }
        setFavorites(favs);
        console.log('收藏数据已保存到 localStorage');
        console.log('localStorage 中的收藏数据:', localStorage.getItem(STORAGE_KEYS.favorites));
        return;
      }

      if (detailBtn) {
        // 点击"探柠详情"按钮跳转到商品详情页
        e.preventDefault();
        e.stopPropagation();
        window.location.href = `product.html?id=${id}`;
        return;
      }

      // 点击商品卡片其他区域跳转到商品详情页，传递商品ID
      window.location.href = `product.html?id=${id}`;
    });

  // 先尝试从后端加载商品列表，失败时降级为本地 PRODUCTS
  if (typeof BACKEND_BASE_URL !== 'undefined') {
    fetch(`${BACKEND_BASE_URL}/api/products`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.ok && Array.isArray(data.items)) {
          productsFromServer = data.items;
          window.productsFromServer = productsFromServer;
        }
      })
      .catch((err) => {
        console.error("加载后端商品列表失败，使用本地数据", err);
      })
      .finally(() => {
        rerender();
      });
  } else {
    rerender();
  }
}

function setupWeatherPage() {
  const setText = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(v);
  };

  // 从本地文件获取天气数据
  fetch('js/weather_data.json')
    .then(response => response.json())
    .then(data => {

      // 更新当前天气信息
      setText("wxTemp", data.temp);
      setText("wxDesc", data.desc);
      setText("wxHum", data.humidity);
      setText("wxRain", data.precip);
      setText("wxWindDir", data.windDir);
      setText("wxWindSpeed", data.windSpeed);
      
      // 根据天气状况生成提示信息
      let tip = "";
      if (data.desc.includes("晴")) {
        tip = "光照充足，利于柠檬糖分积累";
      } else if (data.desc.includes("雨")) {
        tip = "雨天注意排水，防止柠檬树烂根";
      } else if (data.desc.includes("雾")) {
        tip = "雾天湿度大，注意通风防病害";
      } else if (data.desc.includes("多云")) {
        tip = "天气适宜，有利于柠檬生长";
      } else {
        tip = "关注天气变化，做好柠檬管理";
      }
      setText("wxTip", tip);
    })
    .catch(error => {
      console.error('请求天气数据时出错:', error);
    });
}

document.addEventListener("DOMContentLoaded", () => {
  setupProductPage();
  setupWeatherPage();
});

