/**
 * Tus - 公告系统
 * 首次进入播放全屏公告动画；之后从导航栏打开最终动态公告。
 */
(function () {
  var SEEN_KEY = 'tus_announcement_seen_20260716_motion_v1';
  var DEMO_PATH = 'design-demos/announcement-zaha-flow-v2.html';

  function buildOverlay(animate) {
    var overlay = document.createElement('div');
    var mode = animate ? 'embed=1' : 'embed=1&final=1';
    var frame = document.createElement('iframe');

    overlay.className = 'announcement-overlay announcement-motion-overlay';
    overlay.id = 'announcementOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Tus 公告');

    frame.className = 'announcement-motion-frame';
    frame.src = DEMO_PATH + '?' + mode;
    frame.title = 'Tus 公告';
    frame.setAttribute('allowtransparency', 'true');

    overlay.appendChild(frame);
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closeOverlay(overlay);
    });
    overlay._frame = frame;
    return overlay;
  }

  function closeOverlay(overlay) {
    if (!overlay || overlay.classList.contains('is-closing')) return;
    overlay.classList.add('is-closing');
    if (overlay._onAnnouncementKeydown) {
      document.removeEventListener('keydown', overlay._onAnnouncementKeydown);
    }
    window.setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 460);
  }

  window.showAnnouncement = function (options) {
    if (document.getElementById('announcementOverlay')) return;
    var animate = !options || options.animate !== false;
    var overlay = buildOverlay(animate);
    document.body.appendChild(overlay);

    overlay._onAnnouncementKeydown = function (event) {
      if (event.key === 'Escape') closeOverlay(overlay);
    };
    document.addEventListener('keydown', overlay._onAnnouncementKeydown);
    overlay._frame.addEventListener('load', function () {
      overlay.classList.add('is-loaded');
    }, { once: true });
  };

  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin) return;
    if (!event.data || event.data.type !== 'tus-announcement-close') return;
    var overlay = document.getElementById('announcementOverlay');
    if (overlay && overlay._frame && event.source === overlay._frame.contentWindow) {
      closeOverlay(overlay);
    }
  });

  function init() {
    var trigger = document.getElementById('navAnnouncement');
    if (trigger) {
      trigger.addEventListener('click', function () {
        window.showAnnouncement({ animate: false });
      });
    }

    if (document.body && document.body.getAttribute('data-announcement-auto') === 'false') return;
    if (localStorage.getItem(SEEN_KEY)) return;

    function tryShow() {
      if (!document.body) {
        window.setTimeout(tryShow, 50);
        return;
      }
      window.showAnnouncement({ animate: true });
      localStorage.setItem(SEEN_KEY, '1');
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      tryShow();
    } else {
      document.addEventListener('DOMContentLoaded', tryShow, { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
