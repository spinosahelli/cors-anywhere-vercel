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
    
    // 如果是根路径访问（直接打开网站），不检查白名单，显示帮助页面
    if (url === '/' || url === '') {
        proxy.emit('request', req, res);
        return;
    }
    
    const isAllowed = whitelist.length === 0 || (origin && whitelist.includes(origin));
    
    // 白名单检查
    if (!isAllowed) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Origin not allowed');
        return;
    }

    // 转发请求
    proxy.emit('request', req, res);
};
