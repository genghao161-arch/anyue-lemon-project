// 活动数据（本地兜底）
const ACTIVITIES = [];

// 后端返回的活动列表
let activitiesFromServer = [];

// 暴露到全局
window.ACTIVITIES = ACTIVITIES;
window.activitiesFromServer = activitiesFromServer;

// 优先获取后端活动列表
document.addEventListener('DOMContentLoaded', function() {
  if (typeof BACKEND_BASE_URL === 'undefined') {
    return;
  }
  fetch(`${BACKEND_BASE_URL}/api/activities`)
    .then(res => res.json())
    .then(data => {
      if (data && data.ok && Array.isArray(data.items)) {
        activitiesFromServer = data.items;
        window.activitiesFromServer = activitiesFromServer;
      }
    })
    .catch(err => {
      console.error('加载活动列表失败，使用本地数据', err);
    });
});
