// 登录注册页面逻辑
document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const switchToRegister = document.getElementById('switchToRegister');
  const switchToLogin = document.getElementById('switchToLogin');
  const loginTabs = document.querySelectorAll('.login-tab');

  // 切换登录/注册表单与标签状态
  function switchMode(mode) {
    const isLogin = mode === 'login';
    loginForm.classList.toggle('login-form--active', isLogin);
    registerForm.classList.toggle('login-form--active', !isLogin);
    loginTabs.forEach(function(tab) {
      tab.classList.toggle('login-tab--active', tab.getAttribute('data-mode') === mode);
    });
  }

  // 登录、注册标签按钮点击
  loginTabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      const mode = this.getAttribute('data-mode');
      if (mode) switchMode(mode);
    });
  });

  // 底部链接：切换到注册
  if (switchToRegister) {
    switchToRegister.addEventListener('click', function(e) {
      e.preventDefault();
      switchMode('register');
    });
  }

  // 底部链接：切换到登录
  if (switchToLogin) {
    switchToLogin.addEventListener('click', function(e) {
      e.preventDefault();
      switchMode('login');
    });
  }

  // 登录表单提交
  loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const phone = document.getElementById('loginPhone').value.trim();
    const password = document.getElementById('loginPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;

    // 简单的验证
    if (!phone || !password) {
      alert('请填写完整的登录信息');
      return;
    }

    // 调用后端登录接口
    fetch(`${BACKEND_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ phone, password }),
    })
      .then(res => res.json())
      .then(data => {
        if (!data.ok) {
          alert(data.error || '登录失败，请稍后重试');
          return;
        }

        AuthManager.login(data.user);

        // 如果勾选记住我，可以在本地多存一份标记（这里简单示意）
        if (rememberMe) {
          localStorage.setItem('rememberPhone', phone);
        } else {
          localStorage.removeItem('rememberPhone');
        }

        alert('登录成功！');
        window.location.href = 'vote.html';
      })
      .catch(err => {
        console.error('登录请求失败', err);
        alert('登录失败，请检查网络或稍后重试');
      });
  });

  // 注册表单提交
  registerForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('registerName').value.trim();
    const phone = document.getElementById('registerPhone').value.trim();
    const password = document.getElementById('registerPassword').value;
    const passwordConfirm = document.getElementById('registerPasswordConfirm').value;

    // 验证
    if (!name || !phone || !password || !passwordConfirm) {
      alert('请填写完整的注册信息');
      return;
    }

    if (password.length < 6) {
      alert('密码长度至少为6位');
      return;
    }

    if (password !== passwordConfirm) {
      alert('两次输入的密码不一致');
      return;
    }

    // 调用后端注册接口
    fetch(`${BACKEND_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ phone, password }),
    })
      .then(res => res.json())
      .then(data => {
        if (!data.ok) {
          alert(data.error || '注册失败，请稍后重试');
          return;
        }

        AuthManager.login(data.user);

        alert('注册并登录成功！');
        window.location.href = 'vote.html';
      })
      .catch(err => {
        console.error('注册请求失败', err);
        alert('注册失败，请检查网络或稍后重试');
      });
  });
});
