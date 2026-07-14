/* Minimal static server for local previews. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

http.createServer(function (request, response) {
  var urlPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (urlPath === '/') urlPath = '/index.html';
  var filePath = path.resolve(root, '.' + urlPath);
  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    return response.end('Forbidden');
  }
  fs.readFile(filePath, function (error, content) {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500);
      return response.end('Not found');
    }
    response.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
    response.end(content);
  });
}).listen(8000, function () {
  console.log('Tus preview is available at http://localhost:8000');
});
