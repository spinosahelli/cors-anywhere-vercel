const https = require('https');
const http = require('http');

module.exports = async (req, res) => {
  console.log(`[Proxy] ${req.method} ${req.url}`);
  
  // 1. Dynamic CORS Setup
  const origin = req.headers.origin || '*';
  const requestHeaders = req.headers['access-control-request-headers'];
  
  const setCorsHeaders = (response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK');
    response.setHeader('Access-Control-Allow-Headers', '*');
    response.setHeader('Access-Control-Expose-Headers', '*');
    response.setHeader('Access-Control-Allow-Credentials', 'false');
    response.setHeader('Access-Control-Max-Age', '86400');
    response.setHeader('X-Proxy-Version', '1.6.7');
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
    const path = req.url.split('?')[0].replace(/^\/api\//, '').replace(/^\/api$/, '');
    try {
      const base = targetBase.endsWith('/') ? targetBase : targetBase + '/';
      const cleanPath = path.startsWith('/') ? path.substring(1) : path;
      targetUrl = new URL(cleanPath, base).href;
    } catch (e) {
      targetUrl = targetBase + (targetBase.endsWith('/') ? '' : '/') + (path.startsWith('/') ? path.substring(1) : path);
    }
  } else if (queryUrl) {
    targetUrl = queryUrl;
  } else {
    const path = req.url.split('?')[0];
    if (path === '/api' || path === '/api/' || path === '/') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        status: 'Proxy Active', 
        version: '1.6.7',
        info: 'Target URL should be provided in X-Target-URL header'
      }));
      return;
    }
    targetUrl = req.url.replace(/^\/api\//, '').replace(/^(https?):\/+/, '$1://');
  }

  if (!targetUrl || !targetUrl.startsWith('http')) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ 
      status: 'Proxy Active', 
      version: '1.6.7',
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
    delete options.headers['access-control-request-headers'];
    delete options.headers['access-control-request-method'];

    if (!options.headers['user-agent']) {
      options.headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    const transport = parsedUrl.protocol === 'https:' ? https : http;
    const proxyReq = transport.request(options, (proxyRes) => {
      res.statusCode = proxyRes.statusCode;
      
      Object.keys(proxyRes.headers).forEach(key => {
        const lowerKey = key.toLowerCase();
        if (![
          'access-control-allow-origin', 
          'access-control-allow-methods', 
          'access-control-allow-headers', 
          'access-control-allow-credentials', 
          'access-control-expose-headers', 
          'content-encoding', 
          'transfer-encoding', 
          'connection',
          'keep-alive',
          'proxy-authenticate',
          'proxy-authorization',
          'te',
          'trailers',
          'upgrade'
        ].includes(lowerKey)) {
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
