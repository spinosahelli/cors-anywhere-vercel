const https = require('https');
const http = require('http');

module.exports = async (req, res) => {
  // 1. Dynamic CORS Setup
  const origin = req.headers.origin || '*';
  const requestHeaders = req.headers['access-control-request-headers'];
  
  const setCorsHeaders = (response) => {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK');
    // Echo back requested headers or use a comprehensive fallback
    response.setHeader('Access-Control-Allow-Headers', requestHeaders || 'Authorization, Content-Type, Depth, Destination, If, Lock-Token, Overwrite, Timeout, X-Requested-With, Accept, Accept-Language, Cache-Control, Content-Length, Range, Prefer, X-Target-URL');
    response.setHeader('Access-Control-Expose-Headers', 'DAV, ETag, Content-Location, Content-Range, Accept-Ranges, Link, Location, Retry-After, Server, WWW-Authenticate, Content-Length');
    response.setHeader('Access-Control-Allow-Credentials', 'false');
    response.setHeader('Access-Control-Max-Age', '86400');
  };

  setCorsHeaders(res);

  // 2. Handle Preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  // 3. Determine Target URL
  let targetBase = req.headers['x-target-url'];
  let targetUrl;

  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  const queryUrl = reqUrl.searchParams.get('url');

  if (targetBase) {
    // Header-based: combine base from header with path from request
    const path = req.url.split('?')[0].replace(/^\/api\//, '');
    try {
      // Ensure base ends with slash and path doesn't start with one for clean joining
      const base = targetBase.endsWith('/') ? targetBase : targetBase + '/';
      const cleanPath = path.startsWith('/') ? path.substring(1) : path;
      targetUrl = new URL(cleanPath, base).href;
    } catch (e) {
      targetUrl = targetBase + path;
    }
  } else if (queryUrl) {
    targetUrl = queryUrl;
  } else {
    targetUrl = req.url.replace(/^\/api\//, '').replace(/^(https?):\/+/, '$1://');
  }

  if (!targetUrl || !targetUrl.startsWith('http')) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ 
      status: 'Proxy Active', 
      version: '1.6.1',
      info: 'Target URL should be provided in X-Target-URL header'
    }));
    return;
  }

  try {
    const parsedUrl = new URL(targetUrl);
    const options = {
      method: req.method,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      headers: { ...req.headers },
    };

    delete options.headers.host;
    delete options.headers.origin;
    delete options.headers.referer;
    delete options.headers.connection;
    delete options.headers['x-target-url'];

    options.headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    const transport = parsedUrl.protocol === 'https:' ? https : http;
    const proxyReq = transport.request(options, (proxyRes) => {
      res.statusCode = proxyRes.statusCode;
      
      Object.keys(proxyRes.headers).forEach(key => {
        const lowerKey = key.toLowerCase();
        if (!['access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers', 'access-control-allow-credentials', 'access-control-expose-headers', 'content-encoding', 'transfer-encoding', 'connection'].includes(lowerKey)) {
          res.setHeader(key, proxyRes.headers[key]);
        }
      });
      setCorsHeaders(res);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      res.statusCode = 502;
      setCorsHeaders(res);
      res.end(`Proxy Error: ${err.message}`);
    });

    req.pipe(proxyReq);
  } catch (err) {
    res.statusCode = 500;
    setCorsHeaders(res);
    res.end(`Internal Proxy Error: ${err.message}`);
  }
};
