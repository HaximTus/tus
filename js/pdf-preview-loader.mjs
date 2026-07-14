import * as pdfjsLib from './pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./pdf.worker.min.mjs', import.meta.url).href;
window.TusPdfPreview = pdfjsLib;
window.dispatchEvent(new Event('tus:pdf-ready'));
