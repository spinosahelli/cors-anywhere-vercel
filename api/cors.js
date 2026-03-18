const corsProxy = require('cors-anywhere');

// 从环境变量读取白名单，如果没有则用空数组（允许所有）
const whitelist = process.env.CORSANYWHERE_WHITELIST 
  ? process.env.CORSANYWHERE_WHITELIST.split(',') 
  : [];

const proxy = corsProxy.createServer({
    // 白名单设置
    originWhitelist: whitelist,
    
    // 关键修改：禁用对 X-Requested-With 头的要求
    requireHeader: [],  // 改为空数组，不再要求特定头
    
    // 允许所有 WebDAV 需要的 HTTP 方法
    allowedMethods: [
        'GET', 'POST', 'PUT', 'DELETE', 'OPTIONS',
        'PROPFIND', 'PROPPATCH', 'MKCOL', 'COPY', 'MOVE',
        'LOCK', 'UNLOCK', 'CHECKOUT', 'CHECKIN', 'REPORT',
        'VERSION-CONTROL', 'ACL'
    ],
    
    // 允许的请求头
    allowedHeaders: [
        'Content-Type', 'Depth', 'Destination', 'If',
        'Lock-Token', 'Overwrite', 'Timeout',
        'Authorization', 'X-Requested-With'
    ],
    
    // 移除的请求头
    removeHeaders: [
        'cookie', 'cookie2'
    ],
    
    // 不在这里预设 CORS 头，让后面的动态逻辑处理
    setHeaders: {},
    
    // 允许携带凭证
    credentials: true
});

module.exports = (req, res) => {
    // 获取请求来源
    const origin = req.headers.origin;
    
    // 检查是否在白名单中（如果白名单不为空）
    const isAllowed = whitelist.length === 0 || (origin && whitelist.includes(origin));
    
    // 处理 OPTIONS 预检请求
    if (req.method === 'OPTIONS') {
        const headers = {
            'Access-Control-Allow-Methods': 'PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, DELETE, LOCK, UNLOCK, PUT, GET, POST, OPTIONS, HEAD',
            'Access-Control-Allow-Headers': 'Content-Type, Depth, Destination, If, Lock-Token, Overwrite, Timeout, Authorization, X-Requested-With, Origin',
            'Access-Control-Max-Age': '86400',
            'Content-Length': '0'
        };
        
        // 如果允许，设置具体的 origin 而不是 *
        if (isAllowed && origin) {
            headers['Access-Control-Allow-Origin'] = origin;
            headers['Access-Control-Allow-Credentials'] = 'true';
            res.writeHead(200, headers);
        } else {
            // 不允许，返回 403
            res.writeHead(403);
        }
        res.end();
        return;
    }
    
    // 非 OPTIONS 请求，先设置 CORS 头
    if (origin && isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    // 转发请求
    proxy.emit('request', req, res);
};
