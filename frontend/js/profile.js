// 个人中心页面逻辑
document.addEventListener('DOMContentLoaded', function() {
  // 检查登录状态
  if (!AuthManager.isLoggedIn()) {
    // 未登录，显示登录提示
    const loginPrompt = document.getElementById('loginPrompt');
    const profileContent = document.getElementById('profileContent');
    
    if (loginPrompt) loginPrompt.style.display = 'block';
    if (profileContent) profileContent.style.display = 'none';
  } else {
    // 已登录，显示个人中心内容
    const loginPrompt = document.getElementById('loginPrompt');
    const profileContent = document.getElementById('profileContent');
    
    if (loginPrompt) loginPrompt.style.display = 'none';
    if (profileContent) profileContent.style.display = 'block';
    
    // 更新用户信息
    const user = AuthManager.getCurrentUser();
    if (user) {
      const profileName = document.querySelector('.profile-name');
      if (profileName) {
        profileName.textContent = user.name || '石刻护柠';
      }
    }
    
    // 显示登出按钮并绑定事件
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.style.display = 'inline-block';
      logoutBtn.addEventListener('click', function() {
        if (confirm('确定要退出登录吗？')) {
          AuthManager.logout();
          window.location.href = 'login.html';
        }
      });
    }
  }
});
