const https = require('https');
const http = require('http');

module.exports = async (req, res) => {
  const setCorsHeaders = (response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK');
    response.setHeader('Access-Control-Allow-Headers', '*');
    response.setHeader('Access-Control-Expose-Headers', '*');
    response.setHeader('Access-Control-Allow-Credentials', 'false');
    response.setHeader('Access-Control-Max-Age', '86400');
    response.setHeader('X-Proxy-Version', '1.6.8');
  };

  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  let targetBase = req.headers['x-target-url'];
  let targetUrl;

  if (targetBase) {
    const path = req.url.split('?')[0].replace(/^\/api\//, '').replace(/^\/api$/, '');
    const base = targetBase.endsWith('/') ? targetBase : targetBase + '/';
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    targetUrl = new URL(cleanPath, base).href;
  } else {
    const path = req.url.split('?')[0];
    if (path === '/api' || path === '/api/' || path === '/') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'Proxy Active', version: '1.6.8' }));
      return;
    }
    targetUrl = req.url.replace(/^\/api\//, '').replace(/^(https?):\/+/, '$1://');
  }

  if (!targetUrl || !targetUrl.startsWith('http')) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'Proxy Active', version: '1.6.8' }));
    return;
  }

  try {
    const parsedUrl = new URL(targetUrl);
    const transport = parsedUrl.protocol === 'https:' ? https : http;
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
    delete options.headers['x-target-url'];

    const proxyReq = transport.request(options, (proxyRes) => {
      res.statusCode = proxyRes.statusCode;
      Object.keys(proxyRes.headers).forEach(key => {
        if (!key.toLowerCase().startsWith('access-control-')) {
          res.setHeader(key, proxyRes.headers[key]);
        }
      });
      setCorsHeaders(res);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => {
      res.statusCode = 502;
      res.end(`Proxy Error: ${err.message}`);
    });
    req.pipe(proxyReq);
  } catch (err) {
    res.statusCode = 500;
    res.end(`Internal Proxy Error: ${err.message}`);
  }
};
