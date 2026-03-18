const https = require('https');
const http = require('http');

module.exports = async (req, res) => {
  // 1. Dynamic CORS Headers - Echo back what the browser wants
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Access-Control-Allow-Credentials', 'false');

  // 2. Handle Preflight (OPTIONS) immediately
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  // 3. Robust Target URL Extraction
  // We look for the first occurrence of "http" in the path
  const fullPath = req.url;
  const httpIndex = fullPath.indexOf('http');
  
  if (httpIndex === -1) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end(`Proxy Active. Usage: /api/https://your-webdav-url\nDetected Path: ${fullPath}`);
    return;
  }

  let targetUrl = fullPath.substring(httpIndex);
  
  // Fix cases where Vercel collapses double slashes (https:/dav... -> https://dav...)
  targetUrl = targetUrl.replace(/^(https?):\/([^\/])/, '$1://$2');

  try {
    const parsedUrl = new URL(targetUrl);
    const transport = parsedUrl.protocol === 'https:' ? https : http;

    // 4. Clean and Forward Headers
    const headers = { ...req.headers };
    delete headers['host'];
    delete headers['connection'];
    delete headers['origin'];
    delete headers['referer'];
    headers['host'] = parsedUrl.host; // Critical: Must match target

    const proxyReq = transport.request(targetUrl, {
      method: req.method,
      headers: headers
    }, (proxyRes) => {
      // 5. Copy Response Status and Headers back to browser
      res.statusCode = proxyRes.statusCode;
      Object.keys(proxyRes.headers).forEach(key => {
        const lowerKey = key.toLowerCase();
        // Don't copy back headers that might break CORS or encoding
        if (!['access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers', 'content-encoding', 'transfer-encoding'].includes(lowerKey)) {
          res.setHeader(key, proxyRes.headers[key]);
        }
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      res.statusCode = 500;
      res.end('Proxy Request Error: ' + err.message);
    });

    // Pipe the request body (for uploads)
    req.pipe(proxyReq);
  } catch (error) {
    res.statusCode = 500;
    res.end('Proxy Internal Error: ' + error.message);
  }
};
