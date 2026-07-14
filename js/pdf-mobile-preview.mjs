if (window.matchMedia('(max-width: 640px)').matches) {
    window.TusMobilePdfReady = import('./pdf.min.mjs').then(function(pdfjsLib) {
        var workerUrl = new URL('./pdf.worker.min.mjs', import.meta.url).href;
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
        fetch(workerUrl, { cache: 'force-cache' }).catch(function() {});
        return pdfjsLib;
    });
} else {
    window.TusMobilePdfReady = Promise.resolve(null);
}

window.dispatchEvent(new Event('tus:mobile-pdf-init'));
