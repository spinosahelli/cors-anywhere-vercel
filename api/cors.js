const corsProxy = require('cors-anywhere');

const whitelist = process.env.CORSANYWHERE_WHITELIST 
  ? process.env.CORSANYWHERE_WHITELIST.split(',') 
  : [];

const proxy = corsProxy.createServer({
    originWhitelist: whitelist,
    requireHeader: [],
    allowedMethods: [
        'GET', 'POST', 'PUT', 'DELETE', 'OPTIONS',
        'PROPFIND', 'PROPPATCH', 'MKCOL', 'COPY', 'MOVE',
        'LOCK', 'UNLOCK', 'CHECKOUT', 'CHECKIN', 'REPORT',
        'VERSION-CONTROL', 'ACL'
    ],
    allowedHeaders: [
        'Content-Type', 'Depth', 'Destination', 'If',
        'Lock-Token', 'Overwrite', 'Timeout',
        'Authorization', 'X-Requested-With'
    ],
    removeHeaders: ['cookie', 'cookie2'],
    // 让 cors-anywhere 处理这些头
    setHeaders: {
        'Access-Control-Allow-Credentials': 'true'
    },
    credentials: true
});

module.exports = (req, res) => {
    const origin = req.headers.origin;
    const isAllowed = whitelist.length === 0 || (origin && whitelist.includes(origin));
    
    // 处理 OPTIONS 请求
    if (req.method === 'OPTIONS') {
        // cors-anywhere 会自动处理 OPTIONS
        proxy.emit('request', req, res);
        return;
    }
    
    // 检查白名单
    if (!isAllowed) {
        res.writeHead(403);
        res.end('Origin not allowed');
        return;
    }
    
    // 直接转发，让 cors-anywhere 处理所有头
    proxy.emit('request', req, res);
};
