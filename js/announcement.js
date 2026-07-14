/**
 * Tus - 公告系统
 * 首次进入显示公告遮罩，之后可通过导航栏「公告」入口再次打开
 */
(function () {

  /* ========== 公告内容 ========== */
  var HEADER_HTML =
    '<div class="announcement-date">二〇二六年七月十四日</div>' +
    '<div class="announcement-header-row">' +
      '<div class="announcement-title" id="announcementTitle">公告</div>' +
      '<div class="announcement-seal">A</div>' +
    '</div>';

  var BODY_HTML =
    '<p>致同学们：</p>' +
    '<p>Tus 北京工业大学试卷共享平台现已完成基础功能建设，当前继续征集各课程的期中、期末及历年试卷资料。</p>' +
    '<p><strong>本次更新：登录系统正式上线。</strong>用户可以注册账户并在不同设备上登录，账户用于识别试卷提交者并保护提交流程。浏览、搜索及下载已收录试卷无需登录；上传新试卷时需要先登录。</p>' +
    '<p><strong>PDF 试卷预览优化。</strong>已收录试卷现常驻阿里云服务器，预览优先直接读取国内文件源，不再依赖首次访问时从 GitHub 回源。电脑端保持原有预览方式；手机端先显示原生预览，并在站内渲染准备完成后自动切换为适配预览框宽度的多页视图。</p>' +
    '<p>如持有尚未收录的试卷，欢迎登录后提交。提交内容将进入审核队列，经维护者审核后发布，以保证资料的准确性与可用性。</p>' +
    '<p>感谢各位同学对试卷共享平台建设的支持。</p>' +
    '<div class="announcement-signature-wrapper">' +
      '<span class="announcement-signature">— Haxim Tus</span>' +
      '<span class="announcement-stamp">H</span>' +
    '</div>';

  /* ========== 存储键 ========== */
  var SEEN_KEY = 'tus_announcement_seen_20260714_aliyun_paper_storage';

  /* ========== 构建 DOM ========== */
  function buildOverlay() {
    var overlay = document.createElement('div');
    overlay.className = 'announcement-overlay';
    overlay.id = 'announcementOverlay';

    overlay.innerHTML =
      '<div class="announcement-scroll" role="dialog" aria-modal="true" aria-labelledby="announcementTitle" tabindex="-1">' +
        '<div class="announcement-rod announcement-rod-top" aria-hidden="true"></div>' +
        '<button class="announcement-close" id="announcementClose" type="button" aria-label="关闭公告" title="关闭公告">&times;</button>' +
        '<div class="announcement-card">' +
          '<div class="announcement-header">' + HEADER_HTML + '</div>' +
          '<div class="announcement-body">' + BODY_HTML + '</div>' +
        '</div>' +
        '<div class="announcement-rod announcement-rod-bottom" aria-hidden="true"></div>' +
      '</div>';

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closeOverlay(overlay);
    });

    var btn = overlay.querySelector('#announcementClose');
    btn.addEventListener('click', function () {
      closeOverlay(overlay);
    });

    return overlay;
  }

  function closeOverlay(overlay) {
    if (overlay.classList.contains('is-closing')) return;
    overlay.classList.add('is-closing');
    if (overlay._onAnnouncementKeydown) {
      document.removeEventListener('keydown', overlay._onAnnouncementKeydown);
    }
    setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 640);
  }

  /* ========== 显示公告 ========== */
  window.showAnnouncement = function () {
    if (document.getElementById('announcementOverlay')) return;
    var overlay = buildOverlay();
    document.body.appendChild(overlay);
    overlay._onAnnouncementKeydown = function (event) {
      if (event.key === 'Escape') closeOverlay(overlay);
    };
    document.addEventListener('keydown', overlay._onAnnouncementKeydown);
    overlay.querySelector('.announcement-scroll').focus({ preventScroll: true });
  };

  /* ========== 初始化 ========== */
  function init() {
    // 导航栏「公告」点击
    var trigger = document.getElementById('navAnnouncement');
    if (trigger) {
      trigger.addEventListener('click', function () {
        window.showAnnouncement();
      });
    }

    // 登录等任务页面可保留公告入口，但不自动打断当前流程。
    if (document.body && document.body.getAttribute('data-announcement-auto') === 'false') return;

    // 首次访问 → 展示公告
    if (localStorage.getItem(SEEN_KEY)) return;

    // 用定时器确保 DOM 已就绪，不依赖 load 事件（避免 CDN 加载慢导致公告不出）
    function tryShow() {
      if (!document.body) { setTimeout(tryShow, 50); return; }
      window.showAnnouncement();
      localStorage.setItem(SEEN_KEY, '1');
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      tryShow();
    } else {
      document.addEventListener('DOMContentLoaded', tryShow);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
