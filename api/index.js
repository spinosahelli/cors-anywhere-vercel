const https = require('https');
const http = require('http');

export default function handler(req, res) {
  // 1. Absolute Permissive CORS Headers
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Depth, Destination, If, Lock-Token, Overwrite, Timeout, X-Requested-With, Accept, Accept-Language, Cache-Control');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  res.setHeader('Access-Control-Max-Age', '86400');

  // 2. Handle Preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3. Extract and Fix Target URL
  let targetUrl = req.url.replace(/^\/api\//, '');
  // Fix protocol if collapsed (e.g., https:/dav... -> https://dav...)
  targetUrl = targetUrl.replace(/^(https?):\/+/, '$1://');

  if (!targetUrl.startsWith('http')) {
    return res.status(200).json({ status: 'Proxy Active', version: '1.4.0' });
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

    // Remove headers that would interfere with the target server
    delete options.headers.host;
    delete options.headers.origin;
    delete options.headers.referer;
    delete options.headers.connection;

    // 4. Stream the Request
    const transport = parsedUrl.protocol === 'https:' ? https : http;
    const proxyReq = transport.request(options, (proxyRes) => {
      // Set status and copy headers
      res.status(proxyRes.statusCode);
      Object.keys(proxyRes.headers).forEach(key => {
        const lowerKey = key.toLowerCase();
        if (!['access-control-allow-origin', 'content-encoding', 'transfer-encoding', 'connection'].includes(lowerKey)) {
          res.setHeader(key, proxyRes.headers[key]);
        }
      });
      // Re-apply CORS
      res.setHeader('Access-Control-Allow-Origin', origin);
      // Pipe response back
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('Proxy Request Error:', err);
      res.status(502).send(`Proxy Error: ${err.message}`);
    });

    // Pipe request body to target
    req.pipe(proxyReq);
  } catch (err) {
    console.error('Proxy Setup Error:', err);
    res.status(500).send(`Internal Proxy Error: ${err.message}`);
  }
}
