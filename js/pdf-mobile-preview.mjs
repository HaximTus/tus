(function () {
    function loadScript(src) {
        return new Promise(function(resolve, reject) {
            var script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = function() { reject(new Error('PDF script failed: ' + src)); };
            document.head.appendChild(script);
        });
    }

    window.TusMobilePdfReady = loadScript('js/pdf.compat.min.js?v=2').then(function() {
        if (!window.pdfjsLib) throw new Error('PDF.js did not initialize');
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/pdf.worker.compat.min.js?v=2';
        return window.pdfjsLib;
    });

    window.dispatchEvent(new Event('tus:mobile-pdf-init'));
})();
