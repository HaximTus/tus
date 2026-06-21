/**
 * Tus - 通用 UI 组件
 * 回到顶部按钮、暗色模式切换
 */

// ========== 暗色模式切换 ==========
(function() {
  var KEY = 'tus_dark';
  var toggle = document.getElementById('darkToggle');

  function applyDark(isDark) {
    if (isDark) {
      document.documentElement.classList.add('dark');
      if (toggle) toggle.textContent = '亮';
    } else {
      document.documentElement.classList.remove('dark');
      if (toggle) toggle.textContent = '暗';
    }
  }

  // 初始化：优先 localStorage，其次系统偏好
  var stored = localStorage.getItem(KEY);
  if (stored === '1') {
    applyDark(true);
  } else if (stored === '0') {
    applyDark(false);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    applyDark(true);
    localStorage.setItem(KEY, '1');
  }

  // 切换按钮
  if (toggle) {
    toggle.addEventListener('click', function() {
      var isDark = !document.documentElement.classList.contains('dark');
      applyDark(isDark);
      localStorage.setItem(KEY, isDark ? '1' : '0');
    });
  }
})();

// ========== 回到顶部按钮 ==========
(function() {
  function init() {
    // 只在页面足够长时添加（有滚动）
    var bodyHeight = document.documentElement.scrollHeight;
    var viewportHeight = window.innerHeight;
    if (bodyHeight <= viewportHeight + 100) return;

    var btn = document.createElement('button');
    btn.className = 'back-to-top';
    btn.setAttribute('aria-label', '回到顶部');
    btn.innerHTML = '↑';
    btn.title = '回到顶部';
    document.body.appendChild(btn);

    var ticking = false;
    function onScroll() {
      if (!ticking) {
        requestAnimationFrame(function() {
          if (window.scrollY > 300) {
            btn.classList.add('visible');
          } else {
            btn.classList.remove('visible');
          }
          ticking = false;
        });
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });

    btn.addEventListener('click', function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
