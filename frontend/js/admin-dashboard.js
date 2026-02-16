// 简单的后台管理逻辑（商品管理 + 门店管理）

document.addEventListener('DOMContentLoaded', function() {
  // 第一步：向后端确认当前会话是否为管理员
  fetch(`${BACKEND_BASE_URL}/api/auth/me`, {
    method: 'GET',
    credentials: 'include',
  })
    .then((res) => res.json())
    .then((data) => {
      if (!data.ok || !data.user) {
        alert('请先登录管理员账号');
        window.location.href = 'login.html';
        return;
      }

      const user = data.user;
      if (!(user.is_staff || user.is_superuser)) {
        alert('当前账号没有管理员权限');
        window.location.href = 'index.html';
        return;
      }

      // 顶部用户信息
      const infoEl = document.getElementById('adminUserInfo');
      if (infoEl) {
        infoEl.textContent = `管理员：${user.phone || user.id || '未知'}`;
      }

      const sectionTitle = document.getElementById('adminSectionTitle');
      /** 非模态提示，避免 alert 点击“确定”穿透导致表单被清空 */
      let adminToastTimer = null;
      function showToast(msg, durationMs) {
        const el = document.getElementById('adminToast');
        if (!el) return;
        if (adminToastTimer) clearTimeout(adminToastTimer);
        el.textContent = msg;
        el.classList.add('is-visible');
        adminToastTimer = setTimeout(() => {
          el.classList.remove('is-visible');
          adminToastTimer = null;
        }, durationMs == null ? 2500 : durationMs);
      }
      const sections = {
        dashboard: document.getElementById('section-dashboard'),
        products: document.getElementById('section-products'),
        activities: document.getElementById('section-activities'),
        stores: document.getElementById('section-stores'),
        users: document.getElementById('section-users'),
        customer: document.getElementById('section-customer'),
      };

      function switchSection(key) {
    Object.keys(sections).forEach((k) => {
      if (sections[k]) sections[k].style.display = k === key ? 'block' : 'none';
    });
    if (key !== 'customer' && customerPollTimer) {
      clearInterval(customerPollTimer);
      customerPollTimer = null;
    }
    const menu = document.getElementById('adminMenu');
    if (menu) {
      menu.querySelectorAll('.admin-menu__item').forEach((li) => {
        li.classList.toggle('admin-menu__item--active', li.dataset.section === key);
      });
    }
    if (sectionTitle) {
      const map = {
        dashboard: '仪表板概览',
        products: '商品管理',
        activities: '活动管理',
        stores: '门店管理',
        users: '账户管理',
        customer: '客服管理',
      };
      sectionTitle.textContent = map[key] || '后台管理系统';
    }
    localStorage.setItem('adminCurrentSection', key);
      }

      // 左侧菜单切换
      const menuEl = document.getElementById('adminMenu');
      if (menuEl) {
        menuEl.querySelectorAll('.admin-menu__item').forEach((li) => {
          li.addEventListener('click', () => {
            const key = li.dataset.section;
            switchSection(key);
            if (key === 'products') {
              loadProducts();
            } else if (key === 'activities') {
              initActivitySection();
            } else if (key === 'stores') {
              loadStores();
            } else if (key === 'users') {
              loadUsers();
            } else if (key === 'customer') {
              initCustomerSection();
            }
          });
        });
      }

      let customerSectionInited = false;
      let currentConversationId = null;
      let currentCustomerName = '客户';
      let customerPollTimer = null;
      let activityPollTimer = null;
      let customerApiNotFound = false;
      function initCustomerSection() {
        if (customerSectionInited) {
          loadCustomerConversations();
          return;
        }
        const list = document.getElementById('customerConversationList');
        const header = document.getElementById('customerChatHeader');
        const history = document.getElementById('customerChatHistory');
        const input = document.getElementById('customerMessageInput');
        const sendBtn = document.getElementById('customerSendBtn');
        const emojiBtn = document.getElementById('customerEmojiBtn');
        const imageBtn = document.getElementById('customerImageBtn');
        const imageInput = document.getElementById('customerImageInput');
        const emojiPicker = document.getElementById('customerEmojiPicker');
        const emojiGrid = document.getElementById('customerEmojiGrid');
        if (!list || !header || !history || !input || !sendBtn) return;
        customerSectionInited = true;

        // 表情：点击打开面板，点击表情插入输入框
        const EMOJIS = ['😀','😁','😂','🤣','😊','😍','😘','😎','🤔','😴','👍','👎','👏','🙏','❤️','🔥','🎉','✅','❓','📦','🛒','📞','🕒','📍','🚚','💬','💡','✨','🥳','😅'];
        function closeEmojiPicker() {
          if (emojiPicker) emojiPicker.hidden = true;
        }
        function toggleEmojiPicker() {
          if (!emojiPicker) return;
          emojiPicker.hidden = !emojiPicker.hidden;
        }
        if (emojiGrid && emojiGrid.childElementCount === 0) {
          emojiGrid.innerHTML = EMOJIS.map((e) => `<button type="button" class="admin-emoji-btn" data-emoji="${e}">${e}</button>`).join('');
          emojiGrid.addEventListener('click', (ev) => {
            const btn = ev.target.closest('button[data-emoji]');
            if (!btn) return;
            const e = btn.dataset.emoji || '';
            if (!e) return;
            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? input.value.length;
            const before = input.value.slice(0, start);
            const after = input.value.slice(end);
            input.value = before + e + after;
            const pos = start + e.length;
            input.focus();
            input.setSelectionRange(pos, pos);
          });
        }
        if (emojiBtn) {
          emojiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleEmojiPicker();
          });
        }
        document.addEventListener('click', () => closeEmojiPicker());

        // 图片：选择文件 -> 上传 -> 发送图片消息
        async function uploadImageFile(file) {
          const fd = new FormData();
          fd.append('file', file);
          const resp = await fetch(`${BACKEND_BASE_URL}/api/admin/upload-image`, {
            method: 'POST',
            credentials: 'include',
            body: fd,
          });
          const data = await resp.json().catch(() => null);
          if (!resp.ok || !data || !data.ok || !data.url) {
            throw new Error((data && data.error) || `上传失败（HTTP ${resp.status}）`);
          }
          return data.url;
        }
        async function sendCustomerMessage({ content, image }) {
          if (!currentConversationId) return;
          const resp = await fetch(`${BACKEND_BASE_URL}/api/admin/customer/messages/${currentConversationId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ content: content || '', image: image || null }),
          });
          const data = await resp.json().catch(() => null);
          if (!resp.ok || !data || !data.ok) {
            throw new Error((data && data.error) || `发送失败（HTTP ${resp.status}）`);
          }
        }
        if (imageBtn && imageInput) {
          imageBtn.addEventListener('click', () => {
            if (!currentConversationId) return;
            imageInput.click();
          });
          imageInput.addEventListener('change', async () => {
            const file = imageInput.files && imageInput.files[0];
            if (!file) return;
            const oldText = imageBtn.textContent;
            imageBtn.disabled = true;
            imageBtn.textContent = '⏳';
            try {
              const url = await uploadImageFile(file);
              await sendCustomerMessage({ content: '', image: url });
              loadCustomerMessages(currentConversationId);
              loadCustomerConversations();
            } catch (err) {
              console.error('发送图片失败', err);
              alert(err.message || '发送图片失败');
            } finally {
              imageInput.value = '';
              imageBtn.disabled = false;
              imageBtn.textContent = oldText || '🖼';
            }
          });
        }
        
        function loadCustomerConversations() {
          fetch(`${BACKEND_BASE_URL}/api/admin/customer/conversations`, {
            credentials: 'include',
          })
            .then((res) => {
              if (!res.ok) {
                if (res.status === 404) {
                  throw new Error('API_NOT_FOUND');
                }
                throw new Error(`HTTP ${res.status}`);
              }
              return res.json();
            })
            .then((data) => {
              if (!data.ok) {
                list.innerHTML = '<li class="admin-customer-conv admin-customer-conv--placeholder"><span>暂无会话</span></li>';
                return;
              }
              const conversations = data.items || [];
              if (conversations.length === 0) {
                list.innerHTML = '<li class="admin-customer-conv admin-customer-conv--placeholder"><span>暂无会话，接入客服后会话将显示在此</span></li>';
                const countEl = document.getElementById('customerMsgCount');
                if (countEl) countEl.textContent = '0';
                const navDot = document.getElementById('customerNavDot');
                if (navDot) navDot.classList.remove('is-visible');
                return;
              }
              const currentConvId = currentConversationId;
              let unreadCount = 0;
              list.innerHTML = conversations.map((conv, idx) => {
                const time = conv.lastMessageTime ? new Date(conv.lastMessageTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '';
                const name = conv.customerName || '客户';
                const initial = name.charAt(0);
                const readAt = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('customer_read_' + conv.id) : null;
                const lastMsgTime = conv.lastMessageTime ? new Date(conv.lastMessageTime).getTime() : 0;
                const hasNew = lastMsgTime > 0 && (currentConvId !== String(conv.id)) && (!readAt || lastMsgTime > new Date(readAt).getTime());
                if (hasNew) unreadCount += (conv.unreadCount != null ? Math.max(1, conv.unreadCount) : 1);
                return `
                  <li class="admin-customer-conv ${idx === 0 && !currentConvId ? 'admin-customer-conv--active' : currentConvId === String(conv.id) ? 'admin-customer-conv--active' : ''} ${hasNew ? 'admin-customer-conv--new' : ''}" data-conv-id="${conv.id}">
                    <span class="admin-customer-conv__avatar-wrap">
                      <span class="admin-customer-conv__avatar" title="${name}">${initial}</span>
                      ${hasNew ? '<span class="admin-customer-conv__dot" aria-label="有新消息"></span>' : ''}
                    </span>
                    <div class="admin-customer-conv__body">
                      <div class="admin-customer-conv__name">${name}</div>
                      <div class="admin-customer-conv__preview">${conv.lastMessage || ''}</div>
                    </div>
                    <span class="admin-customer-conv__time">${time}</span>
                  </li>
                `;
              }).join('');
              const countEl = document.getElementById('customerMsgCount');
              if (countEl) countEl.textContent = String(unreadCount);
              const navDot = document.getElementById('customerNavDot');
              if (navDot) navDot.classList.toggle('is-visible', unreadCount > 0);
              if (conversations.length > 0 && !currentConversationId) {
                const first = conversations[0];
                currentConversationId = first.id;
                currentCustomerName = first.customerName || '客户';
                const header = document.getElementById('customerChatHeader');
                if (header) header.querySelector('.admin-customer-chat__title').textContent = currentCustomerName;
                try { sessionStorage.setItem('customer_read_' + first.id, new Date().toISOString()); } catch (e) {}
                loadCustomerMessages(first.id);
              }
              list.querySelectorAll('.admin-customer-conv:not(.admin-customer-conv--placeholder)').forEach((li) => {
                li.addEventListener('click', () => {
                  const convId = li.dataset.convId;
                  list.querySelectorAll('.admin-customer-conv').forEach((el) => el.classList.remove('admin-customer-conv--active'));
                  li.classList.add('admin-customer-conv--active');
                  currentConversationId = convId;
                  try { sessionStorage.setItem('customer_read_' + convId, new Date().toISOString()); } catch (e) {}
                  li.classList.remove('admin-customer-conv--new');
                  const dot = li.querySelector('.admin-customer-conv__dot');
                  if (dot) dot.remove();
                  const name = li.querySelector('.admin-customer-conv__name')?.textContent || '客户';
                  currentCustomerName = name;
                  header.querySelector('.admin-customer-chat__title').textContent = name;
                  loadCustomerMessages(convId);
                });
              });
            })
            .catch((err) => {
              const navDot = document.getElementById('customerNavDot');
              if (navDot) navDot.classList.remove('is-visible');
              if (err.message === 'API_NOT_FOUND') {
                customerApiNotFound = true;
                list.innerHTML = '<li class="admin-customer-conv admin-customer-conv--placeholder"><span style="color:var(--muted);">客服 API 尚未实现，请联系后端开发人员</span></li>';
                if (customerPollTimer) {
                  clearInterval(customerPollTimer);
                  customerPollTimer = null;
                }
              } else {
                console.error('加载会话列表失败', err);
                list.innerHTML = '<li class="admin-customer-conv admin-customer-conv--placeholder"><span>加载失败，请稍后重试</span></li>';
              }
            });
        }
        
        function loadCustomerMessages(convId) {
          if (!convId) return;
          fetch(`${BACKEND_BASE_URL}/api/admin/customer/messages/${convId}`, {
            credentials: 'include',
          })
            .then((res) => {
              if (!res.ok) {
                if (res.status === 404) {
                  throw new Error('API_NOT_FOUND');
                }
                throw new Error(`HTTP ${res.status}`);
              }
              return res.json();
            })
            .then((data) => {
              if (!data.ok) {
                history.innerHTML = '<p class="admin-customer-chat__empty">加载消息失败</p>';
                return;
              }
              const messages = data.items || [];
              if (messages.length === 0) {
                history.innerHTML = '<p class="admin-customer-chat__empty">暂无聊天记录</p>';
                return;
              }
              // 微信式时间显示：相邻消息时间间隔 >= 5 分钟才显示一次居中时间条
              const parts = [];
              const THRESHOLD_MS = 5 * 60 * 1000;
              let lastShownTime = 0;
              for (let i = 0; i < messages.length; i += 1) {
                const msg = messages[i];
                const rawSender = String(msg.senderType ?? msg.sender_type ?? '').trim().toLowerCase();
                const isStaff = rawSender === 'staff' || rawSender === '客服';
                const isCustomer = !isStaff;
                const bubbleClass = isCustomer ? 'admin-customer-msg--customer' : 'admin-customer-msg--staff';
                const label = isCustomer ? '客户' : '客服';
                const content = (msg.content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const imgHtml = msg.image ? `<img src="${String(msg.image).replace(/"/g, '&quot;')}" alt="图片" class="admin-customer-msg__img" />` : '';
                const avatarLetter = isCustomer ? (currentCustomerName ? currentCustomerName.charAt(0) : '客') : '客服';
                const rowClass = isStaff ? 'admin-customer-msg-row admin-customer-msg-row--right' : 'admin-customer-msg-row admin-customer-msg-row--left';
                const t = msg.createdAt ? new Date(msg.createdAt).getTime() : 0;
                if (t && (!lastShownTime || t - lastShownTime >= THRESHOLD_MS)) {
                  const ts = new Date(t).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                  parts.push(`<div class="admin-customer-time-sep">${ts}</div>`);
                  lastShownTime = t;
                }
                const wrapperClass = isStaff ? 'admin-customer-msg-wrapper admin-customer-msg-wrapper--right' : 'admin-customer-msg-wrapper admin-customer-msg-wrapper--left';
                const spacer = isStaff ? '<div class="admin-customer-msg-spacer"></div>' : '';
                parts.push(`
                  <div class="${wrapperClass}">
                    ${spacer}
                    <div class="${rowClass}">
                      <span class="admin-customer-msg__avatar admin-customer-msg__avatar--${isCustomer ? 'customer' : 'staff'}">${avatarLetter}</span>
                      <div class="admin-customer-msg ${bubbleClass}">
                        <!-- <div class="admin-customer-msg__label">${label}</div> -->
                        <p class="admin-customer-msg__content">${content || '（空）'}</p>
                        ${imgHtml}
                      </div>
                    </div>
                  </div>
                `);
              }
              history.innerHTML = parts.join('');
              history.scrollTop = history.scrollHeight;
            })
            .catch((err) => {
              if (err.message === 'API_NOT_FOUND') {
                history.innerHTML = '<p class="admin-customer-chat__empty" style="color:var(--muted);">客服消息 API 尚未实现</p>';
              } else {
                console.error('加载消息失败', err);
                history.innerHTML = '<p class="admin-customer-chat__empty">加载消息失败</p>';
              }
            });
        }
        
        sendBtn.addEventListener('click', async () => {
          const text = (input.value || '').trim();
          if (!text || !currentConversationId) return;
          const btnText = sendBtn.textContent;
          sendBtn.disabled = true;
          sendBtn.textContent = '发送中...';
          try {
            const resp = await fetch(`${BACKEND_BASE_URL}/api/admin/customer/messages/${currentConversationId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ content: text }),
            });
            if (!resp.ok) {
              if (resp.status === 404) {
                alert('客服消息 API 尚未实现，请联系后端开发人员');
                sendBtn.disabled = false;
                sendBtn.textContent = btnText;
                return;
              }
              const data = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
              alert(data.error || '发送失败');
              sendBtn.disabled = false;
              sendBtn.textContent = btnText;
              return;
            }
            const data = await resp.json();
            if (!data.ok) {
              alert(data.error || '发送失败');
              sendBtn.disabled = false;
              sendBtn.textContent = btnText;
              return;
            }
            input.value = '';
            loadCustomerMessages(currentConversationId);
            loadCustomerConversations();
          } catch (err) {
            console.error('发送消息失败', err);
            alert('发送失败，请稍后重试');
          } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = btnText;
          }
        });
        
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
          }
        });
        
        loadCustomerConversations();
        if (customerPollTimer) clearInterval(customerPollTimer);
        customerPollTimer = setInterval(() => {
          if (customerApiNotFound) {
            clearInterval(customerPollTimer);
            customerPollTimer = null;
            return;
          }
          if (document.getElementById('section-customer')?.style.display !== 'none') {
            loadCustomerConversations();
            if (currentConversationId) loadCustomerMessages(currentConversationId);
          }
        }, 3000);
      }

      // 仪表板简单统计：调用已有公开接口
      function refreshDashboardStats() {
    Promise.all([
      fetch(`${BACKEND_BASE_URL}/api/products`).then((r) => r.json()).catch(() => null),
      fetch(`${BACKEND_BASE_URL}/api/activities`).then((r) => r.json()).catch(() => null),
      fetch(`${BACKEND_BASE_URL}/api/stores`).then((r) => r.json()).catch(() => null),
    ]).then(([p, a, s]) => {
      const pc = document.getElementById('statProductCount');
      const ac = document.getElementById('statActivityCount');
      const sc = document.getElementById('statStoreCount');
      if (pc) pc.textContent = p && p.ok && Array.isArray(p.items) ? p.items.length : '-';
      if (ac) ac.textContent = a && a.ok && Array.isArray(a.items) ? a.items.length : '-';
      if (sc) sc.textContent = s && s.ok && Array.isArray(s.items) ? s.items.length : '-';
    });
      }

      // 商品管理逻辑
      const tableBody = document.querySelector('#adminProductsTable tbody');
      const form = document.getElementById('adminProductForm');
      const publishNewBtn = document.getElementById('apPublishNewBtn');
      const specsContainer = document.getElementById('apSpecsContainer');
      const addSpecGroupBtn = document.getElementById('apAddSpecGroup');

      // 门店管理逻辑
      const storeTableBody = document.querySelector('#adminStoresTable tbody');
      const storeForm = document.getElementById('adminStoreForm');
      const storeIdEl = document.getElementById('asId');
      const storeNameEl = document.getElementById('asName');
      const storeCityEl = document.getElementById('asCity');
      const storeAddressEl = document.getElementById('asAddress');
      const storeHoursEl = document.getElementById('asHours');
      const storeLngEl = document.getElementById('asLng');
      const storeLatEl = document.getElementById('asLat');
      const storePhoneEl = document.getElementById('asPhone');
      const storeStatusEl = document.getElementById('asStatus');
      const storeGeocodeBtn = document.getElementById('asGeocodeBtn');

      function renderProducts(list) {
    if (!tableBody) return;
    tableBody.innerHTML = (list || [])
      .map((p) => {
        const statusText = p.status === 1 ? '<span class="admin-status-on">上架</span>' : '<span class="admin-status-off">下架</span>';
        return `
          <tr data-id="${p.id}">
            <td>${p.id}</td>
            <td>${p.title}</td>
            <td><span class="admin-tag">${p.category}</span></td>
            <td>¥${Number(p.price).toFixed(1)}</td>
            <td>${p.stock ?? 0}</td>
            <td>${statusText}</td>
            <td>
              <button type="button" class="admin-btn admin-btn--ghost" data-action="edit">编辑</button>
              <button type="button" class="admin-btn admin-btn--ghost" data-action="delete">删除</button>
            </td>
          </tr>
        `;
      })
      .join('');
      }

      /** 从页面读取当前筛选条件 */
      function getProductFilters() {
        const categoryEl = document.getElementById('apCategoryFilter');
        const searchEl = document.getElementById('apSearchInput');
        const activeTab = document.querySelector('.admin-products-tab--active');
        return {
          category: (categoryEl && categoryEl.value) ? categoryEl.value.trim() : '',
          keyword: (searchEl && searchEl.value) ? searchEl.value.trim() : '',
          status: (activeTab && activeTab.dataset.status) !== undefined ? activeTab.dataset.status : '',
        };
      }

      /** 按筛选条件过滤商品列表（前端过滤） */
      function filterProductItems(items, filters) {
        if (!items || !filters) return items || [];
        let list = items;
        if (filters.category) {
          list = list.filter((p) => p.category === filters.category);
        }
        if (filters.status !== undefined && filters.status !== '') {
          const statusNum = parseInt(filters.status, 10);
          list = list.filter((p) => Number(p.status) === statusNum);
        }
        if (filters.keyword) {
          const kw = filters.keyword.toLowerCase();
          list = list.filter(
            (p) =>
              (p.id && String(p.id).toLowerCase().includes(kw)) ||
              (p.title && String(p.title).toLowerCase().includes(kw))
          );
        }
        return list;
      }

      function loadProducts(filters) {
    const opts = filters && (filters.category || filters.keyword || (filters.status !== undefined && filters.status !== '')) ? filters : null;
    fetch(`${BACKEND_BASE_URL}/api/admin/products`, {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok) {
          alert(data.error || '加载商品列表失败');
          return;
        }
        const raw = data.items || [];
        const list = opts ? filterProductItems(raw, opts) : raw;
        renderProducts(list);
      })
      .catch((err) => {
        console.error('加载商品列表失败', err);
        alert('加载商品列表失败，请稍后重试');
      });
      }

      // 查询按钮：按当前筛选条件刷新列表
      const apQueryBtn = document.getElementById('apQueryBtn');
      if (apQueryBtn) {
        apQueryBtn.addEventListener('click', () => {
          const filters = getProductFilters();
          loadProducts(filters);
        });
      }
      // 重置按钮：清空筛选并刷新
      const apResetFilterBtn = document.getElementById('apResetFilterBtn');
      if (apResetFilterBtn) {
        apResetFilterBtn.addEventListener('click', () => {
          const categoryEl = document.getElementById('apCategoryFilter');
          const searchEl = document.getElementById('apSearchInput');
          if (categoryEl) categoryEl.value = '';
          if (searchEl) searchEl.value = '';
          document.querySelectorAll('.admin-products-tab').forEach((tab) => {
            tab.classList.toggle('admin-products-tab--active', (tab.dataset.status || '') === '');
          });
          loadProducts();
        });
      }
      // 状态筛选项：切换选中
      document.querySelectorAll('.admin-products-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
          document.querySelectorAll('.admin-products-tab').forEach((t) => t.classList.remove('admin-products-tab--active'));
          tab.classList.add('admin-products-tab--active');
        });
      });

      if (tableBody) {
    tableBody.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const tr = btn.closest('tr[data-id]');
      if (!tr) return;
      const id = tr.dataset.id;
      const action = btn.dataset.action;

      if (action === 'edit') {
        // 从行中读数据填入表单（为了简单，重新从接口取一遍）
        fetch(`${BACKEND_BASE_URL}/api/admin/products/${encodeURIComponent(id)}`, {
          credentials: 'include',
        })
          .then((res) => res.json())
          .then((data) => {
            if (!data.ok) {
              alert(data.error || '加载商品信息失败');
              return;
            }
            const p = data.item;
            document.getElementById('apId').value = p.id;
            document.getElementById('apTitle').value = p.title || '';
            document.getElementById('apCategory').value = p.category || 'fresh';
            document.getElementById('apTag').value = p.tag || '';
            document.getElementById('apPrice').value = p.price ?? '';
            document.getElementById('apStock').value = p.stock ?? '';
            document.getElementById('apStatus').value = String(p.status ?? 1);
            
            // 调试日志：检查图片字段
            console.log('Edit product:', p.id, 'img:', p.img, 'image:', p.image, 'images:', p.images);

            // 兼容 p.img 和 p.image (后端可能返回 p.image)
            const mainImgUrl = p.img || p.image || '';
            document.getElementById('apImg').value = mainImgUrl;
            updateMainImgPreview(mainImgUrl);

            // 其他图片：后端可能返回数组
            const imgs = Array.isArray(p.images) ? p.images : [];
            const imgsEl = document.getElementById('apImages');
            if (imgsEl) {
                imgsEl.value = imgs.join('\n');
                if (typeof updateImagesGallery === 'function') updateImagesGallery();
            }
            document.getElementById('apTaobao').value = p.taobaoUrl || '';
            document.getElementById('apDesc').value = p.desc || '';
            document.getElementById('apIsEditing').value = '1';
            // 回填商品规格（前端结构）
            resetSpecsUI();
            if (specsContainer && Array.isArray(p.specs)) {
              p.specs.forEach((g) => {
                const group = createSpecGroup();
                if (!group) return;
                const nameInput = group.querySelector('.admin-spec-group__name');
                if (nameInput) nameInput.value = g.name || '';
                const wrap = group.querySelector('.admin-spec-values');
                if (wrap) {
                  wrap.innerHTML = '';
                  (g.values || []).forEach((v) => {
                    const row = createSpecValueRow();
                    const textInput = row.querySelector('.admin-spec-value__text');
                    const imgInput = row.querySelector('.admin-spec-value__img');
                    if (textInput) textInput.value = v.value || '';
                    if (imgInput) imgInput.value = v.img || '';
                    wrap.appendChild(row);
                  });
                }
                specsContainer.appendChild(group);
              });
            }
            // 回填商品详情
            resetDetailUI();
            if (Array.isArray(p.detailAttributes)) {
                p.detailAttributes.forEach(attr => createDetailRow(attr.name, attr.value));
            } else if (p.detailTable && typeof p.detailTable === 'object') {
                // 兼容旧数据格式
                Object.entries(p.detailTable).forEach(([k, v]) => createDetailRow(k, v));
            }
            if (Array.isArray(p.detailImages)) {
                p.detailImages.forEach(url => createDetailImageRow(url));
            }
            if (typeof renderSkuTable === 'function') {
              renderSkuTable();
              if (Array.isArray(p.skus) && p.skus.length > 0) {
                fillSkuTableFromSkus(p.skus, String(p.price ?? ''), String(p.stock ?? ''));
              }
            }
          });
      } else if (action === 'delete') {
        if (!confirm(`确定要删除商品 ${id} 吗？`)) return;
        fetch(`${BACKEND_BASE_URL}/api/admin/products/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'include',
        })
          .then((res) => res.json().catch(() => ({})))
          .then((data) => {
            if (data && data.ok === false) {
              alert(data.error || '删除失败');
              return;
            }
            loadProducts();
          })
          .catch((err) => {
            console.error('删除失败', err);
            alert('删除失败，请稍后重试');
          });
      }
    });
      }

      if (form) {
    // 只有点击“保存”按钮后才允许清空表单（用标志位，避免自动保存误清空）
    let saveTriggeredBySaveButton = false;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    });
    form.onsubmit = function() { return false; };
    function createSpecValueRow() {
      const row = document.createElement('div');
      row.className = 'admin-spec-value';
      row.innerHTML = `
        <input class="admin-input admin-spec-value__text" type="text" placeholder="规格值，如 1.5kg" />
        <input class="admin-input admin-spec-value__img" type="text" placeholder="图片 URL（可选）" />
        <button type="button" class="admin-spec-link-btn" data-spec-action="upload-img">上传图片</button>
        <button type="button" class="admin-spec-link-btn" data-spec-action="remove-value">删除</button>
      `;
      return row;
    }

    function createSpecGroup() {
      if (!specsContainer) return;
      const group = document.createElement('div');
      group.className = 'admin-spec-group';
      group.innerHTML = `
        <div class="admin-spec-group__header">
          <input class="admin-input admin-spec-group__name" type="text" placeholder="规格名称，如 重量 / 口味" />
          <button type="button" class="admin-spec-link-btn" data-spec-action="remove-group">删除规格</button>
        </div>
        <div class="admin-spec-values"></div>
        <div class="admin-spec-actions">
          <button type="button" class="admin-spec-link-btn" data-spec-action="add-value">添加规格值</button>
        </div>
      `;
      const valuesWrap = group.querySelector('.admin-spec-values');
      if (valuesWrap) {
        valuesWrap.appendChild(createSpecValueRow());
      }
      return group;
    }

    function resetSpecsUI() {
      if (!specsContainer) return;
      specsContainer.innerHTML = '';
    }

    if (specsContainer) {
      specsContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-spec-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-spec-action');
        const group = btn.closest('.admin-spec-group');
        if (action === 'add-value' && group) {
          const wrap = group.querySelector('.admin-spec-values');
          if (wrap) wrap.appendChild(createSpecValueRow());
          if (typeof renderSkuTable === 'function') renderSkuTable();
        } else if (action === 'remove-value') {
          const row = btn.closest('.admin-spec-value');
          if (row) row.remove();
        } else if (action === 'upload-img') {
          const row = btn.closest('.admin-spec-value');
          if (!row) return;
          const imgInput = row.querySelector('.admin-spec-value__img');
          const fileInput = document.createElement('input');
          fileInput.type = 'file';
          fileInput.accept = 'image/*';
          fileInput.style.display = 'none';
          document.body.appendChild(fileInput);
          fileInput.addEventListener('change', async () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) {
              document.body.removeChild(fileInput);
              return;
            }
            try {
              const blob = await showCropModal(file);
              if (!blob) {
                document.body.removeChild(fileInput);
                return;
              }
              const url = await uploadOneImage(blob);
              if (imgInput) imgInput.value = url;
              showToast('规格图片已上传');
            } catch (err) {
              console.error('规格图片上传失败', err);
              alert('规格图片上传失败，请稍后再试');
            } finally {
              document.body.removeChild(fileInput);
            }
          });
          fileInput.click();
        } else if (action === 'remove-group' && group) {
          group.remove();
        }
      });
    }

    if (addSpecGroupBtn && specsContainer) {
      addSpecGroupBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const group = createSpecGroup();
        if (group) specsContainer.appendChild(group);
        renderSkuTable();
      });
    }

    /** 从页面读取商品规格（与 doSaveProduct 中逻辑一致） */
    function getSpecsFromUI() {
      const specs = [];
      if (!specsContainer) return specs;
      specsContainer.querySelectorAll('.admin-spec-group').forEach((g) => {
        const nameInput = g.querySelector('.admin-spec-group__name');
        const specName = nameInput && nameInput.value ? nameInput.value.trim() : '';
        if (!specName) return;
        const values = [];
        g.querySelectorAll('.admin-spec-value').forEach((row) => {
          const textInput = row.querySelector('.admin-spec-value__text');
          const imgInput = row.querySelector('.admin-spec-value__img');
          const valueText = textInput && textInput.value ? textInput.value.trim() : '';
          const imgUrl = imgInput && imgInput.value ? imgInput.value.trim() : '';
          if (!valueText && !imgUrl) return;
          values.push({ value: valueText, img: imgUrl });
        });
        if (values.length) specs.push({ name: specName, values });
      });
      return specs;
    }

    /** 规格组合笛卡尔积 */
    function cartesianProduct(specs) {
      if (!specs || specs.length === 0) return [];
      const result = [];
      function collect(index, path) {
        if (index === specs.length) {
          result.push(path.slice());
          return;
        }
        const group = specs[index];
        const name = group.name || '';
        (group.values || []).forEach((v) => {
          const val = v && v.value ? String(v.value).trim() : '';
          if (!val) return;
          path.push({ groupName: name, value: val });
          collect(index + 1, path);
          path.pop();
        });
      }
      collect(0, []);
      return result;
    }

    /** 生成一行规格的显示文本与 key */
    function skuRowKey(values) {
      return (values || []).map((v) => (v.groupName || '') + ':' + (v.value || '')).join('|');
    }

    const apSkuTableHead = document.getElementById('apSkuTableHead');
    const apSkuTableBody = document.getElementById('apSkuTableBody');
    const apSkuBulkApply = document.getElementById('apSkuBulkApply');

    function renderSkuTable() {
      if (!apSkuTableHead || !apSkuTableBody) return;
      const specs = getSpecsFromUI();
      const defaultPrice = document.getElementById('apPrice') ? (document.getElementById('apPrice').value || '').trim() : '';
      const defaultStock = document.getElementById('apStock') ? (document.getElementById('apStock').value || '').trim() : '';

      if (specs.length === 0) {
        apSkuTableHead.innerHTML = '<tr><th>规格</th><th>*库存</th><th>*价格(元)</th><th>预览图</th><th>规格编码</th></tr>';
        apSkuTableBody.innerHTML = '<tr><td colspan="5" class="admin-sku-empty">请先添加上方「商品规格」并填写规格值，保存时将按规格组合生成；无规格时使用上方统一价格与库存。</td></tr>';
        return;
      }

      const specNames = specs.map((s) => s.name || '规格');
      apSkuTableHead.innerHTML =
        '<tr><th>' +
        specNames.map((n) => escapeHtml(n)).join('</th><th>') +
        '</th><th>*库存</th><th>*价格(元)</th><th>预览图</th><th>规格编码</th></tr>';

      const rows = cartesianProduct(specs);
      apSkuTableBody.innerHTML = rows
        .map((values) => {
          const key = skuRowKey(values);
          const labels = values.map((v) => v.value);
          return (
            '<tr data-sku-key="' +
            escapeHtml(key) +
            '">' +
            labels.map((l) => '<td class="admin-sku-cell-spec">' + escapeHtml(l) + '</td>').join('') +
            '<td><input type="number" class="admin-input" data-sku-field="stock" min="0" value="' +
            escapeHtml(defaultStock) +
            '" /></td>' +
            '<td><input type="number" class="admin-input" data-sku-field="price" step="0.01" min="0" value="' +
            escapeHtml(defaultPrice) +
            '" /></td>' +
            '<td class="admin-sku-img-cell" style="vertical-align:middle;">' +
            '<input type="hidden" data-sku-field="img" value="" />' +
            '<div class="admin-sku-img-box" style="width:50px; height:50px; background:#fafafa; border:1px dashed #ccc; border-radius:4px; display:flex; align-items:center; justify-content:center; cursor:pointer; overflow:hidden; position:relative;" title="点击上传图片">' +
            '<span class="admin-sku-img-placeholder" style="font-size:20px; color:#ccc;">+</span>' +
            '<img class="admin-sku-img-preview" src="" style="display:none; width:100%; height:100%; object-fit:cover;" />' +
            '</div></td>' +
            '<td><input type="text" class="admin-input" data-sku-field="skuCode" placeholder="可选" /></td>' +
            '</tr>'
          );
        })
        .join('');
    }

    function updateSkuRowPreview(tr, url) {
        const imgEl = tr.querySelector('input[data-sku-field="img"]');
        const box = tr.querySelector('.admin-sku-img-box');
        if (!imgEl || !box) return;
        
        imgEl.value = url || '';
        const preview = box.querySelector('.admin-sku-img-preview');
        const placeholder = box.querySelector('.admin-sku-img-placeholder');
        
        if (url) {
            if (preview) { preview.src = url; preview.style.display = 'block'; }
            if (placeholder) placeholder.style.display = 'none';
        } else {
            if (preview) { preview.src = ''; preview.style.display = 'none'; }
            if (placeholder) placeholder.style.display = 'block';
        }
    }

    function fillSkuTableFromSkus(skus, defaultPrice, defaultStock) {
      if (!apSkuTableBody || !Array.isArray(skus)) return;
      const map = {};
      skus.forEach((s) => {
        const key = skuRowKey(s.values || []);
        map[key] = s;
      });
      apSkuTableBody.querySelectorAll('tr[data-sku-key]').forEach((tr) => {
        const key = tr.dataset.skuKey || '';
        const data = map[key];
        const stockEl = tr.querySelector('input[data-sku-field="stock"]');
        const priceEl = tr.querySelector('input[data-sku-field="price"]');
        const imgEl = tr.querySelector('input[data-sku-field="img"]');
        const codeEl = tr.querySelector('input[data-sku-field="skuCode"]');
        const preview = tr.querySelector('[data-sku-preview]');
        if (stockEl) stockEl.value = data ? (data.stock != null ? data.stock : '') : defaultStock ?? '';
        if (priceEl) priceEl.value = data ? (data.price != null ? data.price : '') : defaultPrice ?? '';
        updateSkuRowPreview(tr, data && data.img ? data.img : '');
        if (codeEl) codeEl.value = data && data.skuCode ? data.skuCode : '';
      });
    }

    function readSkusFromTable() {
      const skus = [];
      if (!apSkuTableBody) return skus;
      apSkuTableBody.querySelectorAll('tr[data-sku-key]').forEach((tr) => {
        const key = tr.dataset.skuKey || '';
        const values = [];
        key.split('|').forEach((part) => {
          const i = part.indexOf(':');
          if (i >= 0) values.push({ groupName: part.slice(0, i), value: part.slice(i + 1) });
        });
        const stockEl = tr.querySelector('input[data-sku-field="stock"]');
        const priceEl = tr.querySelector('input[data-sku-field="price"]');
        const imgEl = tr.querySelector('input[data-sku-field="img"]');
        const codeEl = tr.querySelector('input[data-sku-field="skuCode"]');
        const stock = stockEl ? parseInt(stockEl.value || '0', 10) : 0;
        const price = priceEl ? parseFloat(priceEl.value) : NaN;
        if (!Number.isNaN(price) || stock > 0 || (imgEl && imgEl.value.trim()) || (codeEl && codeEl.value.trim())) {
          skus.push({
            values,
            stock: Number.isNaN(stock) ? 0 : stock,
            price: Number.isNaN(price) ? undefined : price,
            img: imgEl && imgEl.value ? imgEl.value.trim() : undefined,
            skuCode: codeEl && codeEl.value ? codeEl.value.trim() : undefined,
          });
        }
      });
      return skus;
    }

    specsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-spec-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-spec-action');
      if (['remove-value', 'remove-group'].includes(action)) {
        setTimeout(renderSkuTable, 0);
      }
    });
    if (apSkuBulkApply) {
      apSkuBulkApply.addEventListener('click', () => {
        const bulkStock = document.getElementById('apSkuBulkStock');
        const bulkPrice = document.getElementById('apSkuBulkPrice');
        const bulkImg = document.getElementById('apSkuBulkImg');
        const stock = bulkStock && bulkStock.value !== '' ? bulkStock.value : null;
        const price = bulkPrice && bulkPrice.value !== '' ? bulkPrice.value : null;
        const img = bulkImg && bulkImg.value ? bulkImg.value.trim() : null;
        if (!apSkuTableBody) return;
        apSkuTableBody.querySelectorAll('tr[data-sku-key]').forEach((tr) => {
          const stockEl = tr.querySelector('input[data-sku-field="stock"]');
          const priceEl = tr.querySelector('input[data-sku-field="price"]');
          const imgEl = tr.querySelector('input[data-sku-field="img"]');
          if (stock !== null && stockEl) stockEl.value = stock;
          if (price !== null && priceEl) priceEl.value = price;
          if (img !== null) updateSkuRowPreview(tr, img);
        });
        showToast('已应用到全部规格行');
      });
    }

    // SKU 表格图片点击上传（事件委托）
    if (apSkuTableBody) {
        apSkuTableBody.addEventListener('click', (e) => {
            const box = e.target.closest('.admin-sku-img-box');
            if (!box) return;
            
            // 创建临时文件输入框
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);
            
            fileInput.addEventListener('change', async () => {
                const file = fileInput.files && fileInput.files[0];
                if (!file) {
                    document.body.removeChild(fileInput);
                    return;
                }
                try {
                    const blob = await showCropModal(file);
                    if (!blob) {
                        document.body.removeChild(fileInput);
                        return;
                    }
                    const url = await uploadOneImage(blob);
                    const tr = box.closest('tr');
                    updateSkuRowPreview(tr, url);
                    showToast('规格图片上传成功');
                } catch(err) {
                    console.error('Upload failed', err);
                    alert('上传失败');
                } finally {
                    document.body.removeChild(fileInput);
                }
            });
            fileInput.click();
        });
    }

    function escapeHtml(str) {
      if (str == null) return '';
      const s = String(str);
      const div = document.createElement('div');
      div.textContent = s;
      return div.innerHTML;
    }

    function doSaveProduct(opts) {
      const autoSave = opts && opts.autoSave === true;
      const id = document.getElementById('apId').value.trim();
      const title = document.getElementById('apTitle').value.trim();
      const category = document.getElementById('apCategory').value;
      const tag = document.getElementById('apTag').value.trim();
      const price = parseFloat(document.getElementById('apPrice').value);
      // 库存可能没有（如果 UI 上移除了），这里容错
      const stockEl = document.getElementById('apStock');
      const stock = stockEl ? parseInt(stockEl.value || '0', 10) : 0;
      const status = parseInt(document.getElementById('apStatus').value || '1', 10);
      const img = document.getElementById('apImg').value.trim();
      const imagesRawEl = document.getElementById('apImages');
      const imagesRaw = imagesRawEl ? imagesRawEl.value.trim() : '';
      const images = imagesRaw
        ? imagesRaw.split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean)
        : [];
      const taobaoUrl = document.getElementById('apTaobao').value.trim();
      const desc = document.getElementById('apDesc').value.trim();
      const isEditing = document.getElementById('apIsEditing').value === '1';

      // 读取商品规格（仅前端结构，后端可选择使用）
      const specs = [];
      if (specsContainer) {
        const groups = specsContainer.querySelectorAll('.admin-spec-group');
        groups.forEach((g) => {
          const nameInput = g.querySelector('.admin-spec-group__name');
          const specName = nameInput && nameInput.value ? nameInput.value.trim() : '';
          if (!specName) return;
          const values = [];
          g.querySelectorAll('.admin-spec-value').forEach((row) => {
            const textInput = row.querySelector('.admin-spec-value__text');
            const imgInput = row.querySelector('.admin-spec-value__img');
            const valueText = textInput && textInput.value ? textInput.value.trim() : '';
            const imgUrl = imgInput && imgInput.value ? imgInput.value.trim() : '';
            if (!valueText && !imgUrl) return;
            values.push({ value: valueText, img: imgUrl });
          });
          if (values.length) {
            specs.push({ name: specName, values });
          }
        });
      }

      if (!id || !title || Number.isNaN(price)) {
        if (!autoSave) alert('请至少填写 ID、标题和价格');
        return;
      }

      const payload = {
        id,
        title,
        category,
        tag,
        price,
        stock,
        status,
        img,
        images,
        taobaoUrl,
        desc,
        specs,
        detailTable: getDetailTableFromUI(),
        detailImages: getDetailImagesFromUI(),
      };
      const skus = readSkusFromTable();
      if (skus.length > 0) payload.skus = skus;

      const url = `${BACKEND_BASE_URL}/api/admin/products${isEditing ? `/${encodeURIComponent(id)}` : ''}`;
      const method = isEditing ? 'PUT' : 'POST';

      return fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
        redirect: 'manual',
      })
        .then((res) => {
          if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) {
            throw new Error('保存接口返回重定向，请检查登录状态');
          }
          return res.json();
        })
        .then((data) => {
          if (!data.ok) {
            // 智能容错：如果 ID 已存在，询问用户是否切换为更新模式
            if (data.error && String(data.error).includes('ID 已存在')) {
               if (confirm('该商品 ID 已存在。是否切换为“更新模式”并覆盖原商品数据？')) {
                   document.getElementById('apIsEditing').value = '1';
                   return doSaveProduct(opts);
               }
            }
            alert(data.error || '保存失败');
            return;
          }
          showToast(autoSave ? '已自动保存' : '保存成功');
          if (saveTriggeredBySaveButton) {
            loadProducts();
            form.reset();
            document.getElementById('apIsEditing').value = '0';
            if (typeof updateMainImgPreview === 'function') updateMainImgPreview('');
            if (typeof updateImagesGallery === 'function') updateImagesGallery();
            // 清空动态生成的规格和详情区域
            resetSpecsUI();
            resetDetailUI();
            // 滚动回顶部
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          saveTriggeredBySaveButton = false;
        })
        .catch((err) => {
          console.error('保存失败', err);
          alert('保存失败，请稍后重试');
        });
    }
    const saveBtn = document.getElementById('apSaveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        saveTriggeredBySaveButton = true;
        doSaveProduct();
      });
    }

    const resetBtn = document.getElementById('apResetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm('确定要清空表单吗？未保存的修改将丢失。')) return;
        form.reset();
        document.getElementById('apIsEditing').value = '0';
        if (typeof renderSkuTable === 'function') renderSkuTable();
        if (typeof updateMainImgPreview === 'function') updateMainImgPreview('');
        if (typeof updateImagesGallery === 'function') updateImagesGallery();
        resetSpecsUI();
        resetDetailUI();
      });
    }

    // 发布新商品：清空表单并滚动到编辑区域顶部
    if (publishNewBtn && form) {
      publishNewBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        form.reset();
        const idInput = document.getElementById('apId');
        const isEditingInput = document.getElementById('apIsEditing');
        if (isEditingInput) isEditingInput.value = '0';
        if (typeof updateMainImgPreview === 'function') updateMainImgPreview('');
        if (typeof updateImagesGallery === 'function') updateImagesGallery();
        resetSpecsUI();
        resetDetailUI();
        if (idInput) idInput.focus();
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
      }

      // 图片选取裁剪框：使用 Cropper.js
      const cropOverlay = document.getElementById('adminCropOverlay');
      const cropImg = document.getElementById('adminCropImg');
      const cropCancelBtn = document.getElementById('adminCropCancel');
      const cropConfirmBtn = document.getElementById('adminCropConfirm');

      let currentCropper = null;
      let currentCropResolve = null;

      function showCropModal(file) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type.startsWith('image/')) {
                reject(new Error('请选择图片文件'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                if (cropImg) {
                    cropImg.src = e.target.result;
                    if (cropOverlay) cropOverlay.classList.add('is-visible');
                    
                    if (currentCropper) {
                        currentCropper.destroy();
                    }
                    
                    if (typeof Cropper !== 'undefined') {
                        currentCropper = new Cropper(cropImg, {
                            viewMode: 1,
                            dragMode: 'move',
                            autoCropArea: 1,
                            restore: false,
                            guides: true,
                            center: true,
                            highlight: false,
                            cropBoxMovable: true,
                            cropBoxResizable: true,
                            toggleDragModeOnDblclick: false,
                        });
                    } else {
                        console.warn('Cropper.js not loaded');
                    }
                    
                    currentCropResolve = resolve;
                } else {
                    reject(new Error('裁剪组件未初始化'));
                }
            };
            reader.readAsDataURL(file);
        });
      }

      function closeCropper() {
        if (cropOverlay) cropOverlay.classList.remove('is-visible');
        if (currentCropper) {
            currentCropper.destroy();
            currentCropper = null;
        }
        currentCropResolve = null;
        if (cropImg) cropImg.src = '';
      }

      if (cropConfirmBtn) {
        cropConfirmBtn.addEventListener('click', () => {
            if (currentCropper && currentCropResolve) {
                currentCropper.getCroppedCanvas().toBlob((blob) => {
                    if (blob) {
                        currentCropResolve(blob);
                    } else {
                        currentCropResolve(null);
                    }
                    closeCropper();
                }, 'image/jpeg', 0.9);
            } else {
                closeCropper();
            }
        });
      }

      if (cropCancelBtn) {
        cropCancelBtn.addEventListener('click', () => {
            if (currentCropResolve) {
                currentCropResolve(null);
            }
            closeCropper();
        });
      }

      // 图片上传（主图/其他图片）
      async function uploadOneImage(file) {
        const fd = new FormData();
        const name = file instanceof File ? file.name : 'crop.jpg';
        fd.append('file', file, name);
        const resp = await fetch(`${BACKEND_BASE_URL}/api/admin/upload-image`, {
          method: 'POST',
          credentials: 'include',
          body: fd,
          redirect: 'manual',
        });
        if (resp.type === 'opaqueredirect' || (resp.status >= 300 && resp.status < 400)) {
          throw new Error('上传接口返回重定向，请检查登录状态');
        }
        const data = await resp.json().catch(() => null);
        if (!data || !data.ok) {
          throw new Error((data && data.error) || `上传失败（HTTP ${resp.status}）`);
        }
        return data.url;
      }

      function renderStores(list) {
        if (!storeTableBody) return;
        storeTableBody.innerHTML = (list || [])
          .map((s) => {
            const statusText = Number(s.status) === 1 ? '<span class="admin-status-on">营业</span>' : '<span class="admin-status-off">关闭</span>';
            return `
              <tr data-id="${s.id}">
                <td>${s.id}</td>
                <td>${s.city || ''}</td>
                <td>${s.name || ''}</td>
                <td>${s.address || ''}</td>
                <td>${statusText}</td>
                <td>
                  <button type="button" class="admin-btn admin-btn--ghost" data-action="edit">编辑</button>
                  <button type="button" class="admin-btn admin-btn--ghost" data-action="delete">删除</button>
                </td>
              </tr>
            `;
          })
          .join('');
      }

      function loadStores() {
        fetch(`${BACKEND_BASE_URL}/api/admin/stores`, {
          credentials: 'include',
        })
          .then((res) => res.json())
          .then((data) => {
            if (!data.ok) {
              alert(data.error || '加载门店列表失败');
              return;
            }
            renderStores(data.items || []);
          })
          .catch((err) => {
            console.error('加载门店列表失败', err);
            alert('加载门店列表失败，请稍后重试');
          });
      }

      if (storeTableBody) {
        storeTableBody.addEventListener('click', (e) => {
          const btn = e.target.closest('button[data-action]');
          if (!btn) return;
          const tr = btn.closest('tr[data-id]');
          if (!tr) return;
          const id = tr.dataset.id;
          const action = btn.dataset.action;

          if (action === 'edit') {
            fetch(`${BACKEND_BASE_URL}/api/admin/stores/${encodeURIComponent(id)}`, {
              credentials: 'include',
            })
              .then((res) => res.json())
              .then((data) => {
                if (!data.ok) {
                  alert(data.error || '加载门店信息失败');
                  return;
                }
                const s = data.item;
                if (storeIdEl) storeIdEl.value = s.id ?? '';
                if (storeNameEl) storeNameEl.value = s.name || '';
                if (storeCityEl) storeCityEl.value = s.city || '';
                if (storeAddressEl) storeAddressEl.value = s.address || '';
                if (storeHoursEl) storeHoursEl.value = s.hours || '';
                if (storeLngEl) storeLngEl.value = s.lng ?? '';
                if (storeLatEl) storeLatEl.value = s.lat ?? '';
                if (storePhoneEl) storePhoneEl.value = s.phone || '';
                if (storeStatusEl) storeStatusEl.value = String(s.status ?? 1);
              });
          } else if (action === 'delete') {
            if (!confirm(`确定要删除门店 ${id} 吗？`)) return;
            fetch(`${BACKEND_BASE_URL}/api/admin/stores/${encodeURIComponent(id)}`, {
              method: 'DELETE',
              credentials: 'include',
            })
              .then((res) => res.json().catch(() => ({})))
              .then((data) => {
                if (data && data.ok === false) {
                  alert(data.error || '删除失败');
                  return;
                }
                // 删除后刷新列表 & 清空表单
                loadStores();
                if (storeForm) storeForm.reset();
                if (storeIdEl) storeIdEl.value = '';
              })
              .catch((err) => {
                console.error('删除门店失败', err);
                alert('删除失败，请稍后重试');
              });
          }
        });
      }

      if (storeForm) {
        storeForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const id = storeIdEl && storeIdEl.value ? String(storeIdEl.value).trim() : '';
          const payload = {
            name: storeNameEl ? storeNameEl.value.trim() : '',
            city: storeCityEl ? storeCityEl.value.trim() : '',
            address: storeAddressEl ? storeAddressEl.value.trim() : '',
            lng: storeLngEl ? storeLngEl.value : '',
            lat: storeLatEl ? storeLatEl.value : '',
            hours: storeHoursEl ? storeHoursEl.value.trim() : '',
            phone: storePhoneEl ? storePhoneEl.value.trim() : '',
            status: storeStatusEl ? parseInt(storeStatusEl.value || '1', 10) : 1,
          };
          if (!payload.name || !payload.city || !payload.address) {
            alert('请至少填写门店名称、城市、地址');
            return;
          }

          const isEditing = Boolean(id);
          const url = `${BACKEND_BASE_URL}/api/admin/stores${isEditing ? `/${encodeURIComponent(id)}` : ''}`;
          const method = isEditing ? 'PUT' : 'POST';

          fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload),
          })
            .then((res) => res.json().catch(() => ({})))
            .then((data) => {
              if (data && data.ok === false) {
                alert(data.error || '保存失败');
                return;
              }
              alert('保存成功');
              // 保存后刷新列表并回到新增
              loadStores();
              storeForm.reset();
              if (storeIdEl) storeIdEl.value = '';
            })
            .catch((err) => {
              console.error('保存门店失败', err);
              alert('保存失败，请稍后重试');
            });
        });

        const resetBtn = document.getElementById('asResetBtn');
        if (resetBtn) {
          resetBtn.addEventListener('click', () => {
            storeForm.reset();
            if (storeIdEl) storeIdEl.value = '';
          });
        }
      }

      if (storeGeocodeBtn) {
        storeGeocodeBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          const city = storeCityEl ? storeCityEl.value.trim() : '';
          const address = storeAddressEl ? storeAddressEl.value.trim() : '';
          if (!address) {
            alert('请先填写门店地址');
            return;
          }
          storeGeocodeBtn.disabled = true;
          const oldText = storeGeocodeBtn.textContent;
          storeGeocodeBtn.textContent = '转换中...';
          try {
            const qs = new URLSearchParams();
            qs.set('address', address);
            if (city) qs.set('city', city);
            const resp = await fetch(`${BACKEND_BASE_URL}/api/admin/geocode?${qs.toString()}`, {
              credentials: 'include',
            });
            const data = await resp.json().catch(() => null);
            if (!data || !data.ok) {
              alert((data && data.error) || `转换失败（HTTP ${resp.status}）`);
              return;
            }
            if (storeLngEl) storeLngEl.value = data.lng ?? '';
            if (storeLatEl) storeLatEl.value = data.lat ?? '';
            alert(`已生成坐标：${data.location}`);
          } catch (err) {
            console.error(err);
            alert('转换失败，请稍后重试');
          } finally {
            storeGeocodeBtn.disabled = false;
            storeGeocodeBtn.textContent = oldText;
          }
        });
      }

      let mainImgObjectUrl = null;
      function updateMainImgPreview(url) {
        console.log('updateMainImgPreview:', url);
        const preview = document.getElementById('apImgPreview');
        const placeholder = document.getElementById('apImgPreviewPlaceholder');
        if (!preview || !placeholder) return;

        if (mainImgObjectUrl) {
          try { URL.revokeObjectURL(mainImgObjectUrl); } catch (_) {}
          mainImgObjectUrl = null;
        }

        const hasUrl = url && String(url).trim().length > 0;
        if (hasUrl) {
          preview.src = url;
          preview.style.display = 'block';
          placeholder.style.display = 'none';
          
          // 确保图片加载失败时显示占位符
          preview.onerror = () => {
              console.error('Image load failed:', url);
              preview.style.display = 'none';
              placeholder.style.display = 'block';
              placeholder.textContent = '图片加载失败';
          };
          preview.onload = () => {
             console.log('Image loaded successfully');
             placeholder.textContent = '暂无图片'; // 恢复默认文本
          }

        } else {
          preview.src = '';
          preview.style.display = 'none';
          placeholder.style.display = 'block';
          placeholder.textContent = '暂无图片';
        }
      }

      const uploadMainBtn = document.getElementById('apUploadImgBtn');
      const mainFileInput = document.getElementById('apImgFile');
      let mainUploading = false;
      if (mainFileInput) {
        mainFileInput.addEventListener('change', function () {
          const file = this.files && this.files[0];
          if (!file || !file.type.startsWith('image/')) return;
          if (mainImgObjectUrl) try { URL.revokeObjectURL(mainImgObjectUrl); } catch (_) {}
          mainImgObjectUrl = URL.createObjectURL(file);
          updateMainImgPreview(mainImgObjectUrl);
        });
      }
      if (uploadMainBtn && mainFileInput) {
        uploadMainBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (mainUploading) return false;
          const file = mainFileInput.files && mainFileInput.files[0];
          if (!file) {
            alert('请先选择图片文件');
            return false;
          }
          const blob = await showCropModal(file);
          if (!blob) return false;
          mainUploading = true;
          const oldText = uploadMainBtn.textContent;
          uploadMainBtn.textContent = '上传中...';
          try {
            const url = await uploadOneImage(blob);
            const imgInput = document.getElementById('apImg');
            if (imgInput) {
              imgInput.value = url;
            }
            updateMainImgPreview(url);
            showToast('上传成功，已填入图片 URL');
            await doSaveProduct({ autoSave: true });
          } catch (err) {
            console.error(err);
            alert(String(err.message || err));
          } finally {
            mainUploading = false;
            uploadMainBtn.textContent = oldText;
          }
          return false;
        });
      }

      // 辅助函数
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      const uploadMoreBtn = document.getElementById('apUploadImagesBtn');
      const moreFilesInput = document.getElementById('apImagesFiles');
      const imagesTextarea = document.getElementById('apImages');
      const imagesGallery = document.getElementById('apImagesGallery');

      function updateImagesGallery() {
        if (!imagesGallery || !imagesTextarea) return;
        const val = imagesTextarea.value.trim();
        const urls = val.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        console.log('updateImagesGallery:', urls);
        
        imagesGallery.innerHTML = '';
        if (urls.length === 0) {
            imagesGallery.innerHTML = '<span style="font-size:12px;color:var(--muted);">暂无其他图片</span>';
        }

        urls.forEach((url, index) => {
            const item = document.createElement('div');
            // item.className = 'admin-gallery-item'; // Styles are missing? Assuming CSS exists or inline styles needed
            item.style.cssText = 'position:relative; width:80px; height:80px; border:1px solid #ddd; border-radius:4px; overflow:hidden; display:flex; align-items:center; justify-content:center; background:#f9f9f9;';
            item.innerHTML = `
                <img src="${escapeHtml(url)}" alt="img" style="max-width:100%; max-height:100%; display:block;">
                <div class="admin-gallery-remove" title="删除" style="position:absolute; top:0; right:0; width:20px; height:20px; background:rgba(0,0,0,0.5); color:#fff; text-align:center; line-height:20px; cursor:pointer; font-size:14px;">×</div>
            `;
            
            item.querySelector('.admin-gallery-remove').onclick = (e) => {
                e.stopPropagation();
                // Re-read current value to ensure sync
                const currentVal = imagesTextarea.value.trim();
                const currentUrls = currentVal.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
                currentUrls.splice(index, 1);
                imagesTextarea.value = currentUrls.join('\n');
                updateImagesGallery();
            };
            imagesGallery.appendChild(item);
        });
      }

      if (imagesTextarea) {
          imagesTextarea.addEventListener('input', updateImagesGallery);
      }

      let moreUploading = false;
      if (uploadMoreBtn && moreFilesInput && imagesTextarea) {
        uploadMoreBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (moreUploading) return false;
          const files = moreFilesInput.files ? Array.from(moreFilesInput.files) : [];
          if (!files.length) {
            alert('请先选择图片文件（可多选）');
            return false;
          }
          moreUploading = true;
          const oldText = uploadMoreBtn.textContent;
          try {
            const urls = [];
            for (const f of files) {
              uploadMoreBtn.textContent = `裁剪中 ${urls.length + 1}/${files.length}...`;
              await delay(120);
              const blob = await showCropModal(f);
              if (!blob) continue;
              uploadMoreBtn.textContent = `上传中 ${urls.length + 1}/${files.length}...`;
              try {
                const url = await uploadOneImage(blob);
                urls.push(url);
              } catch (uploadErr) {
                console.error('单张上传失败', uploadErr);
                showToast('第' + (urls.length + 1) + '张上传失败，已跳过');
              }
            }
            if (urls.length) {
              const existing = imagesTextarea.value.trim();
              const next = [existing, ...urls].filter(Boolean).join('\n');
              imagesTextarea.value = next;
              updateImagesGallery();
              showToast('上传成功，已追加到其他图片');
              await doSaveProduct({ autoSave: true });
            }
          } catch (err) {
            console.error(err);
            alert(String(err.message || err));
          } finally {
            moreUploading = false;
            uploadMoreBtn.textContent = oldText;
            moreFilesInput.value = ''; // Reset input
          }
          return false;
        });
      }

      // --- 5. 商品详情 (Detail Table & Images) ---
      const detailTableContainer = document.getElementById('apDetailTableContainer');
      const addDetailRowBtn = document.getElementById('apAddDetailRowBtn');
      const detailImagesContainer = document.getElementById('apDetailImagesContainer');
      const addDetailImageBtn = document.getElementById('apAddDetailImageBtn');

      function resetDetailUI() {
        if (detailTableContainer) detailTableContainer.innerHTML = '';
        if (detailImagesContainer) detailImagesContainer.innerHTML = '';
      }

      function createDetailRow(key = '', value = '') {
        const row = document.createElement('div');
        row.className = 'admin-spec-value'; // Reuse existing class for styling
        row.style.marginBottom = '8px';
        row.innerHTML = `
          <input type="text" class="admin-input admin-detail-key" placeholder="属性名 (如: 品牌)" value="${escapeHtml(key)}" style="width:120px; flex:none;">
          <input type="text" class="admin-input admin-detail-value" placeholder="属性值 (如: NIKE)" value="${escapeHtml(value)}" style="flex:1;">
          <button type="button" class="admin-spec-link-btn" style="color:#c0392b;">删除</button>
        `;
        row.querySelector('button').onclick = () => row.remove();
        detailTableContainer.appendChild(row);
      }

      function createDetailImageRow(url = '') {
        const row = document.createElement('div');
        row.className = 'admin-spec-value';
        row.style.marginBottom = '8px';
        row.style.alignItems = 'center';
        
        const hasUrl = url && url.trim().length > 0;
        const displayStyle = hasUrl ? 'block' : 'none';

        row.innerHTML = `
          <input type="hidden" class="admin-detail-img-url" value="${escapeHtml(url)}">
          <div class="admin-detail-img-preview" style="flex:1; display:flex; align-items:center; height:60px; background:#fafafa; border:1px dashed #ccc; border-radius:4px; padding:0 12px; margin-right:8px; overflow:hidden;">
             <img src="${escapeHtml(url)}" style="display:${displayStyle}; height:100%; width:auto; object-fit:contain;" alt="预览图">
             <span style="display:${hasUrl ? 'none' : 'block'}; color:#999; font-size:13px;">暂无图片，请点击右侧上传</span>
          </div>
          <input type="file" style="display:none;" accept="image/*">
          <button type="button" class="admin-spec-link-btn" style="color:var(--accent); margin-right:8px;">上传</button>
          <button type="button" class="admin-spec-link-btn" style="color:#c0392b;">删除</button>
        `;

        const urlInput = row.querySelector('.admin-detail-img-url');
        const imgEl = row.querySelector('img');
        const placeholderEl = row.querySelector('span');
        const fileInput = row.querySelector('input[type="file"]');
        const uploadBtn = row.querySelectorAll('button')[0];
        const deleteBtn = row.querySelectorAll('button')[1];

        uploadBtn.onclick = () => fileInput.click();

        fileInput.onchange = async () => {
            if (fileInput.files.length === 0) return;
            const file = fileInput.files[0];
            
            // 尝试裁剪
            let blobToUpload = file;
            try {
                const croppedBlob = await showCropModal(file);
                if (croppedBlob === null) {
                    // 用户取消
                    fileInput.value = '';
                    return;
                }
                blobToUpload = croppedBlob;
            } catch (e) {
                console.warn('裁剪跳过或失败，将尝试上传原图', e);
            }
            
            uploadBtn.textContent = '...';
            uploadBtn.disabled = true;

            try {
                const uploadedUrl = await uploadOneImage(blobToUpload);
                if (uploadedUrl) {
                    urlInput.value = uploadedUrl;
                    imgEl.src = uploadedUrl;
                    imgEl.style.display = 'block';
                    placeholderEl.style.display = 'none';
                }
            } catch (e) {
                alert('上传失败: ' + e.message);
            } finally {
                uploadBtn.textContent = '上传';
                uploadBtn.disabled = false;
                fileInput.value = '';
            }
        };

        deleteBtn.onclick = () => row.remove();
        detailImagesContainer.appendChild(row);
      }

      if (addDetailRowBtn) {
        addDetailRowBtn.addEventListener('click', () => createDetailRow());
      }
      if (addDetailImageBtn) {
        addDetailImageBtn.addEventListener('click', () => createDetailImageRow());
      }

      function getDetailTableFromUI() {
        const table = [];
        if (!detailTableContainer) return table;
        detailTableContainer.querySelectorAll('.admin-spec-value').forEach(row => {
            const kInput = row.querySelector('.admin-detail-key');
            const vInput = row.querySelector('.admin-detail-value');
            if (kInput && vInput) {
                const k = kInput.value.trim();
                const v = vInput.value.trim();
                if (k || v) {
                    table.push({ name: k, value: v });
                }
            }
        });
        return table;
      }

      function getDetailImagesFromUI() {
        const images = [];
        if (!detailImagesContainer) return images;
        detailImagesContainer.querySelectorAll('.admin-spec-value').forEach(row => {
            const input = row.querySelector('.admin-detail-img-url');
            if (input) {
                const url = input.value.trim();
                if (url) images.push(url);
            }
        });
        return images;
      }

      function resetDetailUI() {
        if (detailTableContainer) detailTableContainer.innerHTML = '';
        if (detailImagesContainer) detailImagesContainer.innerHTML = '';
      }

    // =========================================
    // 活动管理模块 (Activity Management)
    // =========================================
    let activitySectionInited = false;
    
    function initActivitySection() {
        if (activitySectionInited) {
            loadActivities();
            // Start polling
            if (activityPollTimer) clearInterval(activityPollTimer);
            activityPollTimer = setInterval(() => loadActivities(true), 3000);
            return;
        }
        activitySectionInited = true;
        loadActivities();
        // Start polling
        if (activityPollTimer) clearInterval(activityPollTimer);
        activityPollTimer = setInterval(() => loadActivities(true), 3000);
        
        // 绑定按钮事件
        const refreshBtn = document.getElementById('aaRefreshBtn');
        if (refreshBtn) refreshBtn.addEventListener('click', loadActivities);
        
        const saveBtn = document.getElementById('aaSaveBtn');
        if (saveBtn) saveBtn.addEventListener('click', saveActivity);
        
        const resetBtn = document.getElementById('aaResetBtn');
        if (resetBtn) resetBtn.addEventListener('click', resetActivityForm);
        
        // 图片上传
        setupActivityImageUpload('aaCoverFile', 'aaUploadCoverBtn', 'aaCoverImg', 'aaCoverPreview', 'aaCoverPlaceholder');
        setupActivityImageUpload('aaPosterFile', 'aaUploadPosterBtn', 'aaPosterImg', 'aaPosterPreview', 'aaPosterPlaceholder');
    }
    
    function setupActivityImageUpload(fileId, btnId, hiddenInputId, previewId, placeholderId) {
        const btn = document.getElementById(btnId);
        const fileInput = document.getElementById(fileId);
        if (!btn || !fileInput) return;
        
        btn.addEventListener('click', async () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) {
                alert('请先选择图片文件');
                return;
            }
            
            const originalText = btn.textContent;
            btn.textContent = '上传中...';
            btn.disabled = true;
            
            try {
                // 使用现有的图片上传接口，直接上传不裁剪
                const url = await uploadOneImage(file);
                
                document.getElementById(hiddenInputId).value = url;
                const img = document.getElementById(previewId);
                const ph = document.getElementById(placeholderId);
                if (img) { img.src = url; img.style.display = 'block'; }
                if (ph) { ph.style.display = 'none'; }
                
                showToast('上传成功');
                fileInput.value = ''; // 清空选择
            } catch (err) {
                console.error('Activity image upload failed', err);
                alert('上传失败: ' + (err.message || '未知错误'));
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }

    function loadActivities(isBackground = false) {
        const tbody = document.querySelector('#adminActivitiesTable tbody');
        if (!tbody) return;
        
        // If passed from event listener, isBackground might be an Event object
        const silent = isBackground === true;

        if (!silent) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">加载中...</td></tr>';
        }
        
        fetch(`${BACKEND_BASE_URL}/api/admin/activities`, {
            credentials: 'include'
        })
        .then(res => res.json())
        .then(data => {
            if (!data.ok) {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">${data.error || '加载失败'}</td></tr>`;
                return;
            }
            
            const items = data.items || [];
            if (items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#999;">暂无活动</td></tr>';
                return;
            }
            
            tbody.innerHTML = items.map(item => {
                const statusMap = { 'active': '进行中', 'draft': '草稿', 'ended': '已结束' };
                const statusText = statusMap[item.status] || item.status;
                const statusColor = item.status === 'active' ? 'green' : (item.status === 'ended' ? 'gray' : 'orange');
                
                return `
                    <tr>
                        <td>
                            <div style="font-weight:bold;">${escapeHtml(item.title)}</div>
                            <div style="font-size:12px; color:#999;">${escapeHtml(item.subtitle || '')}</div>
                        </td>
                        <td>${item.clickCount || 0}</td>
                        <td style="font-size:13px;">
                            <div>起：${item.startDate}</div>
                            <div>止：${item.endDate}</div>
                        </td>
                        <td><span style="color:${statusColor}">${statusText}</span></td>
                        <td>
                            <button class="admin-btn admin-btn--ghost" onclick="editActivity('${item.id}')" style="padding:2px 8px; font-size:12px;">编辑</button>
                            <button class="admin-btn admin-btn--ghost" onclick="deleteActivity('${item.id}')" style="padding:2px 8px; font-size:12px; color:red;">删除</button>
                        </td>
                    </tr>
                `;
            }).join('');
            
            // 将 editActivity 和 deleteActivity 挂载到 window 以便 onclick 调用
            window.editActivity = (id) => {
                const item = items.find(i => String(i.id) === String(id));
                if (item) fillActivityForm(item);
            };
            
            window.deleteActivity = (id) => {
                if (!confirm('确定要删除这个活动吗？')) return;
                fetch(`${BACKEND_BASE_URL}/api/admin/activities/${id}`, {
                    method: 'DELETE',
                    credentials: 'include'
                })
                .then(res => res.json())
                .then(resData => {
                    if (resData.ok) {
                        showToast('删除成功');
                        loadActivities();
                    } else {
                        alert(resData.error || '删除失败');
                    }
                })
                .catch(err => alert('请求失败'));
            };
        })
        .catch(err => {
            console.error(err);
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">网络错误</td></tr>';
        });
    }
    
    function fillActivityForm(item) {
        document.getElementById('aaId').value = item.id;
        document.getElementById('aaTitle').value = item.title;
        document.getElementById('aaSubtitle').value = item.subtitle || '';
        document.getElementById('aaDesc').value = item.description || '';
        document.getElementById('aaStartDate').value = item.startDate;
        document.getElementById('aaEndDate').value = item.endDate;
        document.getElementById('aaStatus').value = item.status || 'draft';
        
        // Cover
        const coverUrl = item.coverImage || '';
        document.getElementById('aaCoverImg').value = coverUrl;
        const coverPreview = document.getElementById('aaCoverPreview');
        const coverPh = document.getElementById('aaCoverPlaceholder');
        if (coverUrl) {
            coverPreview.src = coverUrl;
            coverPreview.style.display = 'block';
            coverPh.style.display = 'none';
        } else {
            coverPreview.style.display = 'none';
            coverPh.style.display = 'block';
        }

        // Poster
        const posterUrl = item.poster || '';
        document.getElementById('aaPosterImg').value = posterUrl;
        const posterPreview = document.getElementById('aaPosterPreview');
        const posterPh = document.getElementById('aaPosterPlaceholder');
        if (posterUrl) {
            posterPreview.src = posterUrl;
            posterPreview.style.display = 'block';
            posterPh.style.display = 'none';
        } else {
            posterPreview.style.display = 'none';
            posterPh.style.display = 'block';
        }
        
        // Scroll to form
        document.getElementById('adminActivityForm').scrollIntoView({ behavior: 'smooth' });
    }
    
    function resetActivityForm() {
        document.getElementById('adminActivityForm').reset();
        document.getElementById('aaId').value = '';
        
        // Reset images
        document.getElementById('aaCoverImg').value = '';
        document.getElementById('aaCoverPreview').style.display = 'none';
        document.getElementById('aaCoverPlaceholder').style.display = 'block';
        
        document.getElementById('aaPosterImg').value = '';
        document.getElementById('aaPosterPreview').style.display = 'none';
        document.getElementById('aaPosterPlaceholder').style.display = 'block';
    }
    
    function saveActivity() {
        const id = document.getElementById('aaId').value;
        const title = document.getElementById('aaTitle').value.trim();
        const startDate = document.getElementById('aaStartDate').value;
        const endDate = document.getElementById('aaEndDate').value;
        
        if (!title || !startDate || !endDate) {
            alert('请填写标题和起止时间');
            return;
        }
        
        const payload = {
            title,
            subtitle: document.getElementById('aaSubtitle').value.trim(),
            description: document.getElementById('aaDesc').value.trim(),
            startDate,
            endDate,
            status: document.getElementById('aaStatus').value,
            coverImage: document.getElementById('aaCoverImg').value.trim(),
            poster: document.getElementById('aaPosterImg').value.trim()
        };
        
        const method = id ? 'PUT' : 'POST';
        const url = id 
            ? `${BACKEND_BASE_URL}/api/admin/activities/${id}`
            : `${BACKEND_BASE_URL}/api/admin/activities`;
            
        const btn = document.getElementById('aaSaveBtn');
        const originalText = btn.textContent;
        btn.textContent = '保存中...';
        btn.disabled = true;
        
        fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            if (data.ok) {
                showToast('保存成功');
                resetActivityForm();
                loadActivities();
            } else {
                alert(data.error || '保存失败');
            }
        })
        .catch(err => {
            console.error(err);
            alert('网络请求失败');
        })
        .finally(() => {
            btn.textContent = originalText;
            btn.disabled = false;
        });
    }

    // =========================================
    // 账户管理模块 (User Management)
    // =========================================
    function loadUsers() {
      fetch(`${BACKEND_BASE_URL}/api/admin/users`, {
        method: 'GET',
        credentials: 'include',
      })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          renderUserTable(data.items || []);
        } else {
          showToast(data.error || '加载用户失败');
        }
      })
      .catch(err => {
        console.error(err);
        showToast('网络请求失败');
      });
    }

    function renderUserTable(list) {
      const tbody = document.querySelector('#adminUsersTable tbody');
      if (!tbody) return;
      tbody.innerHTML = '';
      
      const phoneFilter = (document.getElementById('auSearchInput').value || '').trim();
      
      list.forEach(u => {
        if (phoneFilter && !u.phone.includes(phoneFilter)) return;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${u.id}</td>
          <td>${u.phone}</td>
          <td>${u.date_joined ? u.date_joined.substring(0,10) : '-'}</td>
          <td>${u.last_login ? u.last_login.substring(0,16).replace('T', ' ') : '-'}</td>
          <td>
             <span class="admin-tag ${u.is_staff ? 'admin-status-on' : ''}">
               ${u.is_staff ? '管理员' : '普通用户'}
             </span>
          </td>
          <td>
             <span class="admin-tag ${u.is_active ? 'admin-status-on' : 'admin-status-off'}">
               ${u.is_active ? '启用' : '禁用'}
             </span>
          </td>
          <td>
            <button class="admin-btn admin-btn--ghost" style="padding:2px 8px;font-size:12px;height:auto;" onclick="window.editUser(${u.id})">编辑</button>
            <button class="admin-btn admin-btn--ghost" style="padding:2px 8px;font-size:12px;height:auto;color:#c0392b;" onclick="window.deleteUser(${u.id})">删除</button>
          </td>
        `;
        tbody.appendChild(tr);
      });
      
      // Store list for edit
      window._userList = list;
    }

    // Bind Search events
    const auQueryBtn = document.getElementById('auQueryBtn');
    if (auQueryBtn) {
        auQueryBtn.addEventListener('click', loadUsers);
    }
    const auResetBtn = document.getElementById('auResetFilterBtn');
    if (auResetBtn) {
        auResetBtn.addEventListener('click', () => {
            const input = document.getElementById('auSearchInput');
            if (input) input.value = '';
            loadUsers();
        });
    }

    // Modal Logic
    const userModal = document.getElementById('userModal');
    const auCancelBtn = document.getElementById('auCancelBtn');
    const auSaveBtn = document.getElementById('auSaveBtn');
    const auCreateBtn = document.getElementById('auCreateUserBtn');
    
    if (auCreateBtn) {
        auCreateBtn.addEventListener('click', () => {
            openUserModal();
        });
    }
    
    if (auCancelBtn) {
        auCancelBtn.addEventListener('click', () => {
            userModal.classList.remove('is-visible');
            setTimeout(() => {
                userModal.style.display = 'none';
            }, 200);
        });
    }
    
    if (auSaveBtn) {
        auSaveBtn.addEventListener('click', saveUser);
    }

    function openUserModal(user) {
        const title = document.getElementById('userModalTitle');
        const idInput = document.getElementById('auId');
        const phoneInput = document.getElementById('auPhone');
        const pwdInput = document.getElementById('auPassword');
        const staffSelect = document.getElementById('auIsStaff');
        const activeSelect = document.getElementById('auIsActive');
        
        if (user) {
            title.textContent = '编辑用户';
            idInput.value = user.id;
            phoneInput.value = user.phone;
            phoneInput.disabled = false; // 允许修改手机号
            pwdInput.value = ''; // Don't show password
            pwdInput.placeholder = '留空则不修改';
            staffSelect.value = user.is_staff ? '1' : '0';
            activeSelect.value = user.is_active ? '1' : '0';
        } else {
            title.textContent = '添加用户';
            idInput.value = '';
            phoneInput.value = '';
            phoneInput.disabled = false;
            pwdInput.value = '';
            pwdInput.placeholder = '设置登录密码';
            staffSelect.value = '0'; // Default normal user
            activeSelect.value = '1'; // Default active
        }
        
        userModal.style.display = 'flex';
        // Force reflow
        void userModal.offsetWidth;
        userModal.classList.add('is-visible');
    }

    window.editUser = function(id) {
        const user = (window._userList || []).find(u => u.id == id);
        if (user) openUserModal(user);
    };

    function saveUser() {
        const id = document.getElementById('auId').value;
        const phone = document.getElementById('auPhone').value.trim();
        const password = document.getElementById('auPassword').value.trim();
        const isStaff = document.getElementById('auIsStaff').value === '1';
        const isActive = document.getElementById('auIsActive').value === '1';
        
        if (!id && (!phone || !password)) {
            alert('手机号和密码不能为空');
            return;
        }
        
        const payload = {
            phone,
            password,
            is_staff: isStaff,
            is_active: isActive
        };
        
        const method = id ? 'PUT' : 'POST';
        const url = id 
            ? `${BACKEND_BASE_URL}/api/admin/users/${id}` 
            : `${BACKEND_BASE_URL}/api/admin/users`;
            
        auSaveBtn.disabled = true;
        auSaveBtn.textContent = '保存中...';
        
        fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            if (data.ok) {
                showToast('保存成功');
                userModal.classList.remove('is-visible');
                setTimeout(() => {
                    userModal.style.display = 'none';
                }, 200);
                loadUsers();
            } else {
                alert(data.error || '保存失败');
            }
        })
        .finally(() => {
            auSaveBtn.disabled = false;
            auSaveBtn.textContent = '保存';
        });
    }
    
    window.deleteUser = function(id) {
        if (!confirm('确定要删除该用户吗？此操作不可恢复！')) return;
        
        fetch(`${BACKEND_BASE_URL}/api/admin/users/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        })
        .then(res => res.json())
        .then(data => {
            if (data.ok) {
                showToast('删除成功');
                loadUsers();
            } else {
                alert(data.error || '删除失败');
            }
        });
    };

      // 初始加载：默认直接进入“商品管理”，方便频繁维护商品
      refreshDashboardStats();
      const savedSection = localStorage.getItem('adminCurrentSection') || 'products';
      switchSection(savedSection);
      if (savedSection === 'products') {
        loadProducts();
      } else if (savedSection === 'stores') {
        loadStores();
      } else if (savedSection === 'users') {
        loadUsers();
      } else if (savedSection === 'activities') {
        initActivitySection();
      } else if (savedSection === 'customer') {
        initCustomerSection();
      }
    })
    .catch((err) => {
      console.error('检查管理员登录状态失败', err);
      alert('无法验证登录状态，请稍后重试');
      window.location.href = 'login.html';
    });
});

