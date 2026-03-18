const corsProxy = require('cors-anywhere');

const proxy = corsProxy.createServer({
    originWhitelist: [], 
    requireHeader: [],
    removeHeaders: ['cookie', 'cookie2'],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PROPFIND', 'PROPPATCH', 'MKCOL', 'COPY', 'MOVE', 'LOCK', 'UNLOCK'],
    allowedHeaders: ['Content-Type', 'Depth', 'Destination', 'If', 'Lock-Token', 'Overwrite', 'Timeout', 'Authorization', 'X-Requested-With', 'Accept', 'Accept-Language'],
});

module.exports = (req, res) => {
    // This handles the /api/ prefix correctly
    req.url = req.url.replace(/^\/api/, '');
    
    if (req.url === '/' || req.url === '') {
        res.status(200).send('WebDAV CORS Proxy is active. Usage: [proxy-url]/api/[target-url]');
        return;
    }

    proxy.emit('request', req, res);
};
