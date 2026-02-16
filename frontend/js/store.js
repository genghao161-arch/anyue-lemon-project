// 高德静态地图（restapi.amap.com/v3/staticmap）必须使用「Web服务 Key」
const AMAP_STATIC_KEY =
  window.AMAP_WEB_SERVICE_KEY || "ec8f38aa92cb32349b2a7bd1fa693f9d";

// 门店数据（本地兜底）
const STORES = [
  {
    id: 1,
    name: "石刻护柠 · 北京朝阳店",
    address: "北京市朝阳区建国路88号SOHO现代城A座1层",
    city: "北京",
    lng: 116.468,
    lat: 39.908,
    distance: "337 m",
    hours: "09:00-22:00"
  },
  {
    id: 2,
    name: "石刻护柠 · 北京西城店",
    address: "北京市西城区太平桥大街18号丰融国际203号",
    city: "北京",
    lng: 116.365,
    lat: 39.897,
    distance: "1.2 km",
    hours: "08:30-21:30"
  },
  {
    id: 3,
    name: "石刻护柠 · 北京海淀店",
    address: "北京市海淀区中关村大街1号海龙大厦2层",
    city: "北京",
    lng: 116.315,
    lat: 39.983,
    distance: "2.5 km",
    hours: "09:00-22:00"
  },
  {
    id: 4,
    name: "石刻护柠 · 上海黄浦店",
    address: "上海市黄浦区南京东路100号",
    city: "上海",
    lng: 121.475,
    lat: 31.230,
    distance: "500 m",
    hours: "09:00-22:00"
  },
  {
    id: 5,
    name: "石刻护柠 · 上海徐汇店",
    address: "上海市徐汇区淮海中路999号",
    city: "上海",
    lng: 121.445,
    lat: 31.200,
    distance: "800 m",
    hours: "08:30-21:30"
  },
  {
    id: 6,
    name: "石刻护柠 · 广州天河店",
    address: "广州市天河区天河路208号天河城购物中心1层",
    city: "广州",
    lng: 113.331,
    lat: 23.141,
    distance: "600 m",
    hours: "09:00-22:00"
  },
  {
    id: 7,
    name: "石刻护柠 · 深圳南山店",
    address: "深圳市南山区深南大道9678号大冲商务中心A座",
    city: "深圳",
    lng: 113.952,
    lat: 22.540,
    distance: "450 m",
    hours: "09:00-22:00"
  },
  {
    id: 8,
    name: "石刻护柠 · 成都锦江店",
    address: "成都市锦江区春熙路123号",
    city: "成都",
    lng: 104.081,
    lat: 30.662,
    distance: "300 m",
    hours: "09:00-22:00"
  },
  {
    id: 9,
    name: "石刻护柠 · 杭州西湖店",
    address: "杭州市西湖区文三路259号昌地火炬大厦1层",
    city: "杭州",
    lng: 120.130,
    lat: 30.274,
    distance: "1.1 km",
    hours: "08:30-21:30"
  },
  {
    id: 10,
    name: "石刻护柠 · 安岳总店",
    address: "四川省资阳市安岳县柠都大道88号",
    city: "安岳",
    lng: 105.336,
    lat: 30.097,
    distance: "2.3 km",
    hours: "08:00-20:00"
  }
];

let map = null;
let markers = [];
let currentCity = "北京";
let currentStores = [];
let selectedStoreId = null;

// 后端返回的门店列表
let storesFromServer = [];

function getUniqueCities(list) {
  const set = new Set();
  (list || []).forEach((s) => {
    const c = (s && s.city) ? String(s.city).trim() : '';
    if (c) set.add(c);
  });
  return Array.from(set);
}

function updateCitySelectOptions(list) {
  const citySelect = document.getElementById('citySelect');
  if (!citySelect) return;

  const cities = getUniqueCities(list);
  // 兜底：没有城市时至少保留一个
  const finalCities = cities.length ? cities : [currentCity || '北京'];

  // 如果当前城市不在列表里，自动切到第一个城市
  if (!finalCities.includes(currentCity)) {
    currentCity = finalCities[0];
  }

  citySelect.innerHTML = finalCities
    .map((c) => `<option value="${String(c).replace(/"/g, '&quot;')}">${c}</option>`)
    .join('');
  citySelect.value = currentCity;
}

// 初始化地图
function initMap() {
  const mapContainer = document.getElementById('mapContainer');
  if (!mapContainer) {
    // DOM 还没准备好，稍后再试一次
    setTimeout(initMap, 200);
    return;
  }

  // 已经有地图实例了就不重复创建
  if (map) return;

  // JS API 未加载好时，先用静态地图占位（等数据到来后会刷新）
  if (typeof AMap === 'undefined' || !AMap.Map) {
    // 不在这里报错，避免刷屏；交给 renderStaticMap 做兜底显示
    return;
  }

  map = new AMap.Map('mapContainer', {
    viewMode: '2D',
    zoom: 11,
    center: [116.397428, 39.90923],
    mapStyle: 'amap://styles/whitesmoke',
  });
}

// 渲染门店列表
function renderStoreList(stores) {
  const listEl = document.getElementById('storeList');
  if (!listEl) return;

  if (stores.length === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--muted);">
        <p>未找到门店</p>
        <p style="font-size: 12px; margin-top: 8px;">请尝试更换城市或搜索关键词</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = stores.map((store, index) => {
    return `
      <div class="store-item ${selectedStoreId === store.id ? 'active' : ''}" 
           data-id="${store.id}" 
           data-lng="${store.lng}" 
           data-lat="${store.lat}">
        <div class="store-item__name">
          <span class="store-item__number">${index + 1}</span>
          ${store.name}
        </div>
        <div class="store-item__badges">
          <span class="store-item__badge store-item__badge--hours">营业时间：${store.hours || '09:00-22:00'}</span>
        </div>
        <div class="store-item__address">${store.address}</div>
        <div class="store-item__info">
          <span style="color: var(--accent2); font-size: 12px; cursor: pointer;">查看详情</span>
        </div>
      </div>
    `;
  }).join('');

  // 绑定点击事件
  listEl.querySelectorAll('.store-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = parseInt(item.dataset.id);
      selectStore(id);
    });
  });
}

// 使用高德静态地图渲染门店位置（当 JS 地图不可用时）
function renderStaticMap(stores) {
  const mapContainer = document.getElementById("mapContainer");
  if (!mapContainer) return;

  // 只保留经纬度合法的门店，避免 NaN 传入高德
  const validStores = (stores || []).filter((s) => {
    const lng = Number(s.lng);
    const lat = Number(s.lat);
    return Number.isFinite(lng) && Number.isFinite(lat);
  });

  if (!validStores || validStores.length === 0) {
    mapContainer.innerHTML = `
      <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, rgba(200,176,106,.1), rgba(255,255,255,.2)); color: var(--muted); position: relative;">
        <div style="text-align: center; padding: 20px;">
          <p style="font-size: 16px; margin-bottom: 8px; color: var(--ink);">门店位置地图</p>
          <p style="font-size: 12px; margin-bottom: 4px;">当前城市暂无门店，请更换城市或关键词</p>
        </div>
      </div>
    `;
    return;
  }

  // 静态地图最多支持少量标注，这里只取前 10 个，避免 URL 过长
  const topStores = validStores.slice(0, 10);

  // 以第一个门店作为地图中心
  const center = `${topStores[0].lng},${topStores[0].lat}`;

  // 生成 markers 参数，使用 1~N 的数字标记
  const markersParam = topStores
    .map((store, index) => {
      const label = (index + 1).toString().slice(0, 1); // 单字符
      return `mid,0xC8B06A,${label}:${store.lng},${store.lat}`;
    })
    .join("|");

  const staticUrl = `https://restapi.amap.com/v3/staticmap?key=${AMAP_STATIC_KEY}&location=${center}&zoom=11&size=750*420&markers=${encodeURIComponent(
    markersParam
  )}`;

  mapContainer.innerHTML = `
    <img src="${staticUrl}" alt="门店位置地图"
         style="width: 100%; height: 100%; object-fit: cover; border-radius: 0;" />
  `;
}

// 在地图上标记门店（优先使用 JS 地图，退化为静态地图）
function markStoresOnMap(stores) {
  // JS 地图可用时优先用 JS 地图渲染
  if (!map) {
    // 如果 JS 地图还没初始化成功，先尝试初始化一次（不阻塞）
    initMap();
  }

  if (!map) {
    renderStaticMap(stores);
    return;
  }

  // 清除旧标记
  markers.forEach((m) => map.remove(m));
  markers = [];

  const validStores = (stores || []).filter((s) => {
    const lng = Number(s.lng);
    const lat = Number(s.lat);
    return Number.isFinite(lng) && Number.isFinite(lat);
  });

  if (validStores.length === 0) return;

  validStores.forEach((store, index) => {
    const lng = Number(store.lng);
    const lat = Number(store.lat);

    const marker = new AMap.Marker({
      position: [lng, lat],
      title: store.name,
      // 自定义门店 marker（更美观）
      content: `
        <div class="store-marker" data-store-id="${store.id}">
          <div class="store-marker__halo"></div>
          <div class="store-marker__pin"></div>
          <div class="store-marker__num">${index + 1}</div>
          <div class="store-marker__shadow"></div>
        </div>
      `,
      // 让“尖端”对准经纬度
      offset: new AMap.Pixel(-21, -52),
    });

    marker.on('click', () => {
      selectStore(store.id);
    });

    markers.push(marker);
    map.add(marker);
  });

  // 适配视野（比手动 Bounds 更稳）
  map.setFitView(markers, true);
}

// 暴露给 store.html 的 callback 调用
window.initMap = initMap;

// 选择门店
function selectStore(id) {
  selectedStoreId = id;
  const store = currentStores.find(s => s.id === id);
  if (!store) return;

  // 更新列表高亮
  document.querySelectorAll('.store-item').forEach(item => {
    item.classList.toggle('active', parseInt(item.dataset.id) === id);
  });

  // 移动地图到该门店
  if (map) {
    const lng = Number(store.lng);
    const lat = Number(store.lat);
    // 仅当经纬度合法时才移动视图，避免 LngLat(NaN, NaN) 报错
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      map.setCenter([lng, lat]);
      map.setZoom(16);
    }
  }
}

// 筛选门店
function filterStores(city, query) {
  const source = storesFromServer && storesFromServer.length ? storesFromServer : STORES;
  let filtered = source.filter(store => store.city === city);
  
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(store => 
      store.name.toLowerCase().includes(q) ||
      store.address.toLowerCase().includes(q)
    );
  }

  // 只将经纬度有效的门店用于地图展示，列表仍可展示全部
  const validForMap = filtered.filter((store) => {
    const lng = Number(store.lng);
    const lat = Number(store.lat);
    return Number.isFinite(lng) && Number.isFinite(lat);
  });

  currentStores = filtered;
  renderStoreList(filtered);
  markStoresOnMap(validForMap);
  
  // 如果有门店，优先选中第一个经纬度合法的门店
  if (validForMap.length > 0) {
    selectStore(validForMap[0].id);
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 城市选择
  const citySelect = document.getElementById('citySelect');
  if (citySelect) {
    citySelect.addEventListener('change', (e) => {
      currentCity = e.target.value;
      filterStores(currentCity, document.getElementById('storeSearch')?.value || '');
    });
  }

  // 搜索功能
  const searchInput = document.getElementById('storeSearch');
  const searchBtn = document.getElementById('searchBtn');
  
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      const query = searchInput?.value || '';
      filterStores(currentCity, query);
    });
  }

  if (searchInput) {
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const query = searchInput.value || '';
        filterStores(currentCity, query);
      }
    });
  }

  // 已移除“筛选”按钮

  // 初始加载：先从后端拉门店列表，失败时使用本地数据
  if (typeof BACKEND_BASE_URL !== 'undefined') {
    fetch(`${BACKEND_BASE_URL}/api/stores`)
      .then(res => res.json())
      .then(data => {
        if (data && data.ok && Array.isArray(data.items)) {
          storesFromServer = data.items.map((s, idx) => ({
            // 保证有 id/lng/lat/distance 等字段
            ...s,
            distance: s.distance || '距离约 1km',
            id: s.id ?? idx + 1,
          }));
        }
      })
      .catch(err => {
        console.error('加载门店列表失败，使用本地数据', err);
      })
      .finally(() => {
        const source = (storesFromServer && storesFromServer.length) ? storesFromServer : STORES;
        updateCitySelectOptions(source);
        filterStores(currentCity, '');
      });
  } else {
    updateCitySelectOptions(STORES);
    filterStores(currentCity, '');
  }
});
