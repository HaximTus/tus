var isQuark = /(?:^|\s)Quark(?:PC)?\//i.test(navigator.userAgent || '');

if (window.matchMedia('(max-width: 640px)').matches || isQuark) {
    var pdfModuleUrl = isQuark ? './pdf.legacy.min.mjs' : './pdf.min.mjs';
    window.TusMobilePdfReady = import(pdfModuleUrl).then(function(pdfjsLib) {
        var workerName = isQuark ? './pdf.worker.legacy.min.mjs' : './pdf.worker.min.mjs';
        var workerUrl = new URL(workerName, import.meta.url).href;
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
        fetch(workerUrl, { cache: 'force-cache' }).catch(function() {});
        return pdfjsLib;
    });
} else {
    window.TusMobilePdfReady = Promise.resolve(null);
}

window.dispatchEvent(new Event('tus:mobile-pdf-init'));
