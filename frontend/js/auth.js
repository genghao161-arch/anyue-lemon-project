// 认证状态管理
// 自动判断后端地址：如果是本地开发环境，使用 127.0.0.1；如果是部署环境，使用当前访问的域名或指定的公网 IP
const BACKEND_BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
  ? 'http://127.0.0.1:8000'
  : 'http://112.74.37.196:8000';

const AuthManager = {
  // 检查是否已登录
  isLoggedIn() {
    const user = localStorage.getItem('user');
    return user !== null;
  },

  // 获取当前用户信息
  getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  // 登录
  login(userData) {
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('isLoggedIn', 'true');
    this.updateNavigation();
  },

  // 登出：清除本地状态并跳转到登录页
  logout() {
    localStorage.removeItem('user');
    localStorage.removeItem('isLoggedIn');
    this.updateNavigation();
    window.location.href = 'login.html';
  },

  // 更新导航栏显示
  updateNavigation() {
    const authArea = document.getElementById('authArea');
    if (!authArea) return;

    const user = this.getCurrentUser();

    const isLoginPage = /login\.html$/i.test(window.location.pathname || '');
    const isVotePage = /vote\.html$/i.test(window.location.pathname || '');

    if (this.isLoggedIn()) {
      const activeClass = isVotePage ? ' toplink--active' : '';
      const isAdmin = !!(user && (user.is_staff || user.is_superuser));

      const adminLinkHtml = isAdmin
        ? '<a class="topbar__dropdown-item" href="admin-dashboard.html">后台管理系统</a>'
        : '';

      authArea.innerHTML = `
        <div class="topbar__auth-dropdown">
          <button type="button" class="toplink toplink--trigger${activeClass}" id="authDropdownTrigger" aria-expanded="false" aria-haspopup="true">个人中心 ▾</button>
          <div class="topbar__dropdown" id="authDropdown" hidden>
            <a class="topbar__dropdown-item" href="vote.html">我的账户</a>
            ${adminLinkHtml}
            <button type="button" class="topbar__dropdown-item topbar__dropdown-item--logout" id="logoutBtn">退出账号</button>
          </div>
        </div>`;
      this._initAuthDropdown();
    } else {
      const activeClass = isLoginPage ? ' toplink--active' : '';
      authArea.innerHTML = `<a class="toplink${activeClass}" href="login.html" id="authLink">登录注册</a>`;
    }
  },

  _initAuthDropdown() {
    const trigger = document.getElementById('authDropdownTrigger');
    const menu = document.getElementById('authDropdown');
    const logoutBtn = document.getElementById('logoutBtn');
    if (!trigger || !menu) return;

    function open() {
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      trigger.classList.add('toplink--trigger-open');
    }
    function close() {
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      trigger.classList.remove('toplink--trigger-open');
    }
    function toggle() {
      if (menu.hidden) open(); else close();
    }

    trigger.addEventListener('click', function(e) {
      e.stopPropagation();
      toggle();
    });

    if (logoutBtn) {
      logoutBtn.addEventListener('click', function() {
        AuthManager.logout();
        close();
      });
    }

    document.addEventListener('click', function(e) {
      if (!menu.hidden && !trigger.contains(e.target) && !menu.contains(e.target)) close();
    });
  },

  // 初始化 - 在页面加载时调用
  init() {
    // 先与后端同步一次登录状态
    fetch(`${BACKEND_BASE_URL}/api/auth/me`, {
      method: 'GET',
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.ok && data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
          localStorage.setItem('isLoggedIn', 'true');
        } else {
          localStorage.removeItem('user');
          localStorage.removeItem('isLoggedIn');
        }
      })
      .catch(() => {
        // 后端不可用时，不阻塞前端展示
      })
      .finally(() => {
        this.updateNavigation();
      });
  }
};

// 页面加载时初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => AuthManager.init());
} else {
  AuthManager.init();
}
