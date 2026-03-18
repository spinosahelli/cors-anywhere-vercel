const corsProxy = require('cors-anywhere');

// 从环境变量读取白名单，如果没有则用空数组（允许所有）
const whitelist = process.env.CORSANYWHERE_WHITELIST 
  ? process.env.CORSANYWHERE_WHITELIST.split(',') 
  : [];

const proxy = corsProxy.createServer({
    // 白名单设置 - 请修改为你的网站地址
    originWhitelist: whitelist,
    
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
    
    // 移除的请求头（不要移除 WebDAV 需要的头）
    removeHeaders: [
        'cookie', 'cookie2'  // 只移除 cookie，保留其他
    ],
    
    // 设置响应头
    setHeaders: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, DELETE, LOCK, UNLOCK, PUT, GET, POST, OPTIONS, HEAD',
        'Access-Control-Allow-Headers': 'Content-Type, Depth, Destination, If, Lock-Token, Overwrite, Timeout, Authorization, X-Requested-With, Origin',
        'Access-Control-Expose-Headers': 'DAV, Content-Length, Allow, Location, Lock-Token',
        'Access-Control-Max-Age': '86400'  // 24小时
    },
    
    // 需要客户端提供的头（可选，建议注释掉）
    // requireHeader: ['origin'],  
    
    // 是否允许携带凭证（如果需要认证就设为 true）
    credentials: true
});

module.exports = (req, res) => {
    // 处理 OPTIONS 预检请求（WebDAV 会频繁发送）
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, DELETE, LOCK, UNLOCK, PUT, GET, POST, OPTIONS, HEAD',
            'Access-Control-Allow-Headers': 'Content-Type, Depth, Destination, If, Lock-Token, Overwrite, Timeout, Authorization, X-Requested-With, Origin',
            'Access-Control-Max-Age': '86400',
            'Access-Control-Allow-Credentials': 'true',
            'Content-Length': '0'
        });
        res.end();
        return;
    }
    
    // 转发其他请求
    proxy.emit('request', req, res);
};
