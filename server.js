const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5000;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.csv': 'text/csv',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // Normalize URL
    let urlPath = req.url.split('?')[0];

    // Handle favicon to avoid console 404 errors
    if (urlPath === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Root route maps to index.html in the root folder
    if (urlPath === '/' || urlPath === '/index.html') {
        const filePath = path.join(__dirname, 'index.html');
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
        return;
    }

    // Serve static files from allowed directories
    const allowedDirectories = ['/css/', '/js/', '/data/', '/docs/', '/static/'];
    const hasAllowedPrefix = allowedDirectories.some(dir => urlPath.startsWith(dir));

    if (hasAllowedPrefix) {
        // Resolve path within the project root
        // Remove leading slash to resolve correctly with path.join
        const relativeFilePath = urlPath.startsWith('/') ? urlPath.substring(1) : urlPath;
        const filePath = path.join(__dirname, relativeFilePath);

        // Simple security check: prevent directory traversal outside of project root folder
        const resolvedPath = path.resolve(filePath);
        const projectRoot = path.resolve(__dirname);
        if (!resolvedPath.startsWith(projectRoot)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden');
            return;
        }

        const ext = path.extname(resolvedPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        fs.readFile(resolvedPath, (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
                return;
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        });
        return;
    }

    // Catch-all: 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

module.exports = server;

if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}
