const https = require('https');
const http = require('http');

module.exports = async (req, res) => {
  // 1. Permissive CORS Headers - Tells the browser this proxy is safe
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK');
  res.setHeader('Access-Control-Allow-Headers', '*'); 
  res.setHeader('Access-Control-Max-Age', '86400');

  // 2. Handle Preflight (OPTIONS) immediately
  // This is where most CORS errors happen. We respond with 200 OK immediately.
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  // 3. Extract Target URL from the path
  // req.url is usually "/api/https://dav.com/..."
  let targetUrl = req.url.replace(/^\/api\//, '');
  
  // Fix potential URL collapsing (https:/dav.com -> https://dav.com)
  if (targetUrl.startsWith('https:/') && !targetUrl.startsWith('https://')) {
    targetUrl = targetUrl.replace('https:/', 'https://');
  } else if (targetUrl.startsWith('http:/') && !targetUrl.startsWith('http://')) {
    targetUrl = targetUrl.replace('http:/', 'http://');
  }

  // If no target is provided, show a status message
  if (!targetUrl || !targetUrl.startsWith('http')) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('WebDAV Proxy Active. Usage: /api/https://your-webdav-url');
    return;
  }

  try {
    // 4. Forward the request to the real WebDAV server
    const parsedUrl = new URL(targetUrl);
    const transport = parsedUrl.protocol === 'https:' ? https : http;

    const proxyReq = transport.request(targetUrl, {
      method: req.method,
      headers: {
        ...req.headers,
        host: parsedUrl.host, // Critical: Jianguoyun requires the correct Host header
        connection: 'keep-alive'
      }
    }, (proxyRes) => {
      // Copy status and headers back to the browser
      res.statusCode = proxyRes.statusCode;
      Object.keys(proxyRes.headers).forEach(key => {
        // Don't copy back headers that might break CORS or encoding
        const lowerKey = key.toLowerCase();
        if (!['content-encoding', 'transfer-encoding', 'access-control-allow-origin'].includes(lowerKey)) {
          res.setHeader(key, proxyRes.headers[key]);
        }
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      res.statusCode = 500;
      res.end('Proxy Error: ' + err.message);
    });

    // Pipe the request body (for PUT/POST) to the target
    req.pipe(proxyReq);
  } catch (error) {
    res.statusCode = 500;
    res.end('Internal Error: ' + error.message);
  }
};
