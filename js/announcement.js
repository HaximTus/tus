/**
 * Tus - 公告系统
 * 首次进入显示公告遮罩，之后可通过导航栏「公告」入口再次打开
 */
(function () {

  /* ========== 公告内容 ========== */
  var HEADER_HTML =
    '<div class="announcement-date">二〇二六年六月十九日</div>' +
    '<div class="announcement-header-row">' +
      '<div class="announcement-title" id="announcementTitle">公告</div>' +
      '<div class="announcement-seal">A</div>' +
    '</div>';

  var BODY_HTML =
    '<p>致同学们：</p>' +
    '<p>今天，Tus 开始面向部分学生进行测试运行。网站可能有一些不尽如人意的地方，希望同学们可以提一些意见。</p>' +
    '<p>Tus 为了减轻同学们考试周的负担，为了北京工业大学学生的试卷自由而生。</p>' +
    '<p>目前网站仅收录部分测试试卷。为构建一个学生无任何付出即可获取自己所需试卷的理想世界，我们不强制但鼓励同学们上传 Tus 未收录的试卷。开源项目需要同学们的共同维护。</p>' +
    '<p>另外，欢迎大家为我的项目 <a href="https://github.com/HaximTus/tus" target="_blank">github.com/HaximTus/tus</a> 点一颗小星星。</p>' +
    '<p>十分感谢同学们的支持。</p>' +
    '<div class="announcement-signature-wrapper">' +
      '<span class="announcement-signature">— Haxim Tus</span>' +
      '<span class="announcement-stamp">H</span>' +
    '</div>';

  /* ========== 存储键 ========== */
  var SEEN_KEY = 'tus_announcement_seen_20260619';

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
