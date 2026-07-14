if (window.matchMedia('(max-width: 640px)').matches) {
    window.TusMobilePdfReady = import('./pdf.min.mjs').then(function(pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./pdf.worker.min.mjs', import.meta.url).href;
        return pdfjsLib;
    });
} else {
    window.TusMobilePdfReady = Promise.resolve(null);
}

window.dispatchEvent(new Event('tus:mobile-pdf-init'));
