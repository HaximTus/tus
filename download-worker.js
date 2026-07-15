/* Tus same-origin paper download handler. */
self.addEventListener('install', function(event) {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(event) {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function(event) {
    var requestUrl = new URL(event.request.url);
    if (requestUrl.origin !== self.location.origin
        || requestUrl.searchParams.get('tus-download') !== '1'
        || requestUrl.pathname.indexOf('/assets/papers/') !== 0) {
        return;
    }

    event.respondWith(handlePaperDownload(requestUrl));
});

function handlePaperDownload(requestUrl) {
    var downloadName = requestUrl.searchParams.get('name') || 'paper.pdf';
    var extensionMatch = downloadName.match(/\.(pdf|docx?)$/i);
    var fallbackName = 'paper' + (extensionMatch ? extensionMatch[0].toLowerCase() : '');
    var sourceUrl = new URL(requestUrl.href);
    sourceUrl.searchParams.delete('tus-download');
    sourceUrl.searchParams.delete('name');

    return fetch(sourceUrl.href, { credentials: 'same-origin', cache: 'force-cache' })
        .then(function(response) {
            if (!response.ok) return response;
            var headers = new Headers(response.headers);
            headers.set(
                'Content-Disposition',
                'attachment; filename="' + fallbackName + '"; filename*=UTF-8\'\'' + encodeURIComponent(downloadName)
            );
            headers.set('X-Content-Type-Options', 'nosniff');
            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: headers
            });
        });
}
