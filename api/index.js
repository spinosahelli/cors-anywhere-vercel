const https = require('https');
const http = require('http');
const url = require('url');

module.exports = async (req, res) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, MKCOL, COPY, MOVE, LOCK, UNLOCK');
  const requestedHeaders = req.headers['access-control-request-headers'];
  if (requestedHeaders) {
    res.setHeader('Access-Control-Allow-Headers', requestedHeaders);
  } else {
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Depth, Destination, Overwrite, X-Requested-With');
  }
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  let targetUrl = req.url.replace(/^\/api\//, '');
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    if (targetUrl.startsWith('/https:/')) {
      targetUrl = targetUrl.substring(1).replace('https:/', 'https://');
    } else if (targetUrl.startsWith('https:/')) {
      targetUrl = targetUrl.replace('https:/', 'https://');
    } else {
      res.statusCode = 400;
      res.end('Invalid target URL');
      return;
    }
  }
  try {
    const parsedUrl = url.parse(targetUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const transport = isHttps ? https : http;
    const headers = { ...req.headers };
    delete headers.host;
    delete headers.origin;
    delete headers.referer;
    delete headers.connection;
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.path,
      method: req.method,
      headers: headers,
      timeout: 30000
    };
    const proxyReq = transport.request(options, (proxyRes) => {
      Object.keys(proxyRes.headers).forEach(key => {
        if (!['content-encoding', 'transfer-encoding', 'connection', 'access-control-allow-origin', 'access-control-allow-credentials', 'access-control-allow-methods', 'access-control-allow-headers'].includes(key.toLowerCase())) {
          res.setHeader(key, proxyRes.headers[key]);
        }
      });
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'false');
      res.statusCode = proxyRes.statusCode;
      proxyRes.pipe(res);
    });
    proxyReq.on('error', (err) => {
      res.statusCode = 502;
      res.end('Proxy Error');
    });
    req.pipe(proxyReq);
  } catch (err) {
    res.statusCode = 500;
    res.end('Internal Proxy Error');
  }
};
