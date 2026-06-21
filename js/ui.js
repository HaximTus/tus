/**
 * Tus - 通用 UI 组件
 * 回到顶部按钮、全局工具函数
 */

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
