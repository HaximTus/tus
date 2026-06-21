/**
 * Tus - 公告系统
 * 首次进入显示公告遮罩，之后可通过导航栏「公告」入口再次打开
 */
(function () {

  /* ========== 公告内容 ========== */
  var HEADER_HTML =
    '<div class="announcement-date">二〇二六年六月十九日</div>' +
    '<div class="announcement-header-row">' +
      '<div class="announcement-title">公<span class="dot"></span>告</div>' +
      '<div class="announcement-seal">A</div>' +
    '</div>';

  var BODY_HTML =
    '<p>致同学们：</p>' +
    '<p>今天，Tus 开始面向部分学生进行测试运行。网站可能有一些不尽如人意的地方（或者一些恶心的 bug），希望同学们可以提一些意见（所谓的部分学生大概都有我微信，所以微信上说就可以了）。</p>' +
    '<p>Tus 为了减轻同学们考试周的负担，为了北京工业大学学生的试卷自由而生。</p>' +
    '<p>目前网站仅收录部分测试试卷（手里试卷有点儿多，会慢慢更新）。为构建一个学生无任何付出即可获取自己所需试卷（未开始考试的试卷除外）的理想世界，我们不强制但鼓励同学们上传 Tus 未收录的试卷。开源项目需要同学们的共同维护。</p>' +
    '<p>另外，欢迎大家为我的项目 <a href="https://github.com/tjiux/tus" target="_blank">github.com/tjiux/tus</a> 点一颗小星星。</p>' +
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
      '<div class="announcement-card">' +
        '<div class="announcement-header">' + HEADER_HTML + '</div>' +
        '<div class="announcement-body">' + BODY_HTML + '</div>' +
        '<div class="announcement-footer">' +
          '<button class="announcement-btn" id="announcementConfirm">确 定</button>' +
        '</div>' +
      '</div>';

    var btn = overlay.querySelector('#announcementConfirm');
    btn.addEventListener('click', function () {
      closeOverlay(overlay);
    });

    return overlay;
  }

  function closeOverlay(overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';
    setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 300);
  }

  /* ========== 显示公告 ========== */
  window.showAnnouncement = function () {
    if (document.getElementById('announcementOverlay')) return;
    var overlay = buildOverlay();
    document.body.appendChild(overlay);
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