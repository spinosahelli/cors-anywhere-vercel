const cors_anywhere = require('cors-anywhere');

const proxy = cors_anywhere.createServer({
    originWhitelist: [], // Allow all origins
    requireHeader: [],   // Don't require X-Requested-With
    removeHeaders: ['cookie', 'cookie2'],
});

module.exports = (req, res) => {
    // 1. Manually handle CORS Preflight for Vercel
    // This ensures the browser always gets a 'green light' for any method/header
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'false');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // 2. Fix the URL for Vercel's routing
    // req.url is usually "/api/https://dav.com/..."
    // We need to strip "/api" to leave "/https://dav.com/..."
    let targetPath = req.url.replace(/^\/api/, '');
    
    // Ensure it starts with a single slash
    if (!targetPath.startsWith('/')) {
        targetPath = '/' + targetPath;
    }

    // 3. If no target is provided, show status
    if (targetPath === '/' || targetPath === '/index') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('WebDAV Proxy Active. Usage: /api/https://your-webdav-url');
        return;
    }

    // 4. Set the URL that cors-anywhere expects
    req.url = targetPath;

    // 5. Hand off to the proxy
    proxy.emit('request', req, res);
};
