window.TusMobilePdfReady = import('./pdf.legacy.min.mjs').then(function(pdfjsLib) {
    var workerUrl = new URL('./pdf.worker.legacy.min.mjs', import.meta.url).href;
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
    fetch(workerUrl, { cache: 'force-cache' }).catch(function() {});
    return pdfjsLib;
});

window.dispatchEvent(new Event('tus:mobile-pdf-init'));
