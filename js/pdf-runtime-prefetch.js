// 低优先级预热 PDF.js；不读取任何试卷文件，避免抢占首页网络。
(function () {
    'use strict';

    var assets = [
        'js/pdf.compat.min.js?v=2',
        'js/pdf.worker.compat.min.js?v=2',
        'js/pdf-mobile-preview.mjs?v=6'
    ];

    function schedule() {
        assets.forEach(function (asset) {
            var link = document.createElement('link');
            link.rel = 'prefetch';
            link.as = asset.indexOf('worker') >= 0 ? 'script' : 'script';
            link.href = asset;
            link.crossOrigin = 'anonymous';
            document.head.appendChild(link);
        });
    }

    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(schedule, { timeout: 2200 });
    } else {
        window.setTimeout(schedule, 900);
    }
})();
