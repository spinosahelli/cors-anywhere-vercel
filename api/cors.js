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
    setHeaders: {},
    credentials: false
});

module.exports = (req, res) => {
    const origin = req.headers.origin;
    const url = req.url;
    
    // 1. 处理根路径访问
    if (url === '/' || url === '') {
        proxy.emit('request', req, res);
        return;
    }
    
    // 2. 安全检查
    const isAllowed = whitelist.length === 0 || (origin && whitelist.includes(origin));
    
    // 3. 关键修复：只要有 origin，就设置 CORS 头
    // 这样即使返回 403 错误，浏览器也能显示具体信息
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'false');
    }

    // 4. 白名单检查失败，返回 403 但带着 CORS 头
    if (!isAllowed) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end(`Origin not allowed: ${origin}`);
        return;
    }

    // 5. 转发请求
    proxy.emit('request', req, res);
};
