const corsProxy = require('cors-anywhere');

// 从环境变量读取白名单
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
    
    // 白名单检查
    if (!isAllowed) {
        res.writeHead(403);
        res.end('Origin not allowed');
        return;
    }

    // 关键修复：确保返回具体的 origin，而不是 '*'
    // 这样即使白名单为空，也能避免与 credentials: true 冲突
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    
    // 转发请求给 cors-anywhere
    proxy.emit('request', req, res);
};
