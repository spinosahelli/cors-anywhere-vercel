const https = require('https');
const http = require('http');

module.exports = async (req, res) => {
  // 1. Absolute Permissive CORS Headers
  const origin = req.headers.origin || '*';
  
  const setCorsHeaders = (response) => {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Depth, Destination, If, Lock-Token, Overwrite, Timeout, X-Requested-With, Accept, Accept-Language, Cache-Control, Content-Length, Range, Prefer');
    response.setHeader('Access-Control-Expose-Headers', 'DAV, ETag, Content-Location, Content-Range, Accept-Ranges, Link, Location, Retry-After, Server, WWW-Authenticate, Content-Length');
    response.setHeader('Access-Control-Allow-Credentials', 'false');
    response.setHeader('Access-Control-Max-Age', '86400');
  };

  // Apply CORS to every response
  setCorsHeaders(res);

  // 2. Handle Preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  // 3. Extract Target URL from Query or Path
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  let targetUrl = reqUrl.searchParams.get('url');
  
  // Fallback to path-based if query param is missing
  if (!targetUrl) {
    targetUrl = req.url.replace(/^\/api\//, '');
    // Fix protocol if collapsed
    targetUrl = targetUrl.replace(/^(https?):\/+/, '$1://');
  }

  if (!targetUrl || !targetUrl.startsWith('http')) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ 
      status: 'Proxy Active', 
      version: '1.5.0',
      usage: 'Append ?url=https://your-webdav-server.com/ to this URL'
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

    // Remove headers that would interfere with the target server
    delete options.headers.host;
    delete options.headers.origin;
    delete options.headers.referer;
    delete options.headers.connection;

    // Add a standard User-Agent for compatibility
    options.headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    // 4. Stream the Request
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
      console.error('Proxy Request Error:', err);
      res.statusCode = 502;
      setCorsHeaders(res);
      res.end(`Proxy Error: ${err.message}`);
    });

    req.pipe(proxyReq);
  } catch (err) {
    console.error('Proxy Setup Error:', err);
    res.statusCode = 500;
    setCorsHeaders(res);
    res.end(`Internal Proxy Error: ${err.message}`);
  }
};
