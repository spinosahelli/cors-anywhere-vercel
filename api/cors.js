const corsProxy = require('cors-anywhere');

// 从环境变量读取白名单
const whitelist = process.env.CORSANYWHERE_WHITELIST 
  ? process.env.CORSANYWHERE_WHITELIST.split(',') 
  : [];

const proxy = corsProxy.createServer({
    // 白名单设置
    originWhitelist: whitelist,
    
    // 不要求特定请求头
    requireHeader: [],
    
    // 允许所有 WebDAV 方法
    allowedMethods: [
        'GET', 'POST', 'PUT', 'DELETE', 'OPTIONS',
        'PROPFIND', 'PROPPATCH', 'MKCOL', 'COPY', 'MOVE',
        'LOCK', 'UNLOCK', 'CHECKOUT', 'CHECKIN', 'REPORT',
        'VERSION-CONTROL', 'ACL'
    ],
    
    // 允许的请求头（包含 Nutstore 需要的 Depth）
    allowedHeaders: [
        'Content-Type', 'Depth', 'Destination', 'If',
        'Lock-Token', 'Overwrite', 'Timeout',
        'Authorization', 'X-Requested-With'
    ],
    
    // 移除的请求头
    removeHeaders: ['cookie', 'cookie2'],
    
    // 关键修改：让 cors-anywhere 自动处理 CORS 头
    // 不要手动设置 Access-Control-Allow-Origin，避免重复
    setHeaders: {},
    
    // 关闭凭证支持，匹配客户端的 credentials: 'omit'
    credentials: false
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

    // 直接转发，让 cors-anywhere 处理所有 CORS 头
    proxy.emit('request', req, res);
};
