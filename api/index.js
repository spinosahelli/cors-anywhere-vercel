const https = require('https');
const http = require('http');

const proxy = async (req, res) => {
  console.log(`[Proxy] ${req.method} ${req.url}`);
  
  // 1. Dynamic CORS Setup
  const setCorsHeaders = (response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK, PATCH');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Depth, X-Requested-With, X-Target-URL, X-Proxy-Version, If, Overwrite, Destination, Range, Lock-Token, Timeout, Accept, Accept-Language, Content-Length, Prefer, Brief, Content-Range, Translate, User-Agent');
    response.setHeader('Access-Control-Expose-Headers', 'X-Proxy-Version, Content-Type, Content-Length, ETag, Last-Modified, WWW-Authenticate, Dav, MS-Author-Via, Location, Content-Range, X-Target-URL');
    response.setHeader('Access-Control-Allow-Credentials', 'false');
    response.setHeader('Access-Control-Max-Age', '86400');
    response.setHeader('X-Proxy-Version', '1.8.8');
  };

  setCorsHeaders(res);

  // 2. Handle Preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.setHeader('Content-Length', '0');
    res.end();
    return;
  }

  // 3. Buffer Body for non-GET requests (to support redirects)
  let bodyBuffer = Buffer.alloc(0);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    try {
      if (req.body) {
        if (Buffer.isBuffer(req.body)) {
          bodyBuffer = req.body;
        } else if (typeof req.body === 'string') {
          bodyBuffer = Buffer.from(req.body);
        } else {
          bodyBuffer = Buffer.from(JSON.stringify(req.body));
        }
      } else {
        const chunks = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        bodyBuffer = Buffer.concat(chunks);
      }
    } catch (e) {
      console.error('[Proxy] Body buffer error:', e);
    }
  }

  // 4. Determine Target URL
  let targetBase = req.headers['x-target-url'];
  let targetUrl;

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const queryUrl = reqUrl.searchParams.get('url');

  if (targetBase) {
    let path = req.url.split('?')[0];
    path = path.replace(/^\/api\//, '').replace(/^\/api$/, '');
    if (path === '/') path = '';

    try {
      const baseUrl = new URL(targetBase);
      const basePath = baseUrl.pathname;
      
      let cleanPath = path;
      if (basePath && basePath !== '/' && cleanPath.startsWith(basePath)) {
        cleanPath = cleanPath.substring(basePath.length);
      }
      if (cleanPath.startsWith('/')) cleanPath = cleanPath.substring(1);

      const base = targetBase.endsWith('/') ? targetBase : targetBase + '/';
      targetUrl = new URL(cleanPath, base).href;
      
      if (req.url.split('?')[0].endsWith('/') && !targetUrl.endsWith('/')) {
        targetUrl += '/';
      }
    } catch (e) {
      const cleanPath = path.startsWith('/') ? path.substring(1) : path;
      targetUrl = targetBase + (targetBase.endsWith('/') ? '' : '/') + cleanPath;
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
        version: '1.8.8',
        info: 'Target URL should be provided in X-Target-URL header'
      }));
      return;
    }
    targetUrl = req.url.replace(/^\/api\//, '').replace(/^(https?):\/+/, '$1://');
  }

  if (!targetUrl || !targetUrl.startsWith('http')) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'Proxy Active', version: '1.8.8' }));
    return;
  }

  const performRequest = (currentUrl, redirectCount = 0) => {
    if (redirectCount > 5) {
      res.statusCode = 502;
      res.end('Proxy Error: Too many redirects');
      return;
    }

    try {
      const parsedUrl = new URL(currentUrl);
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

      if (bodyBuffer.length > 0) {
        options.headers['content-length'] = bodyBuffer.length;
      } else {
        delete options.headers['content-length'];
      }

      if (!options.headers['user-agent']) {
        options.headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      }

      const transport = parsedUrl.protocol === 'https:' ? https : http;
      const proxyReq = transport.request(options, (proxyRes) => {
        if ([301, 302, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
          let redirectUrl = proxyRes.headers.location;
          if (!redirectUrl.startsWith('http')) {
            redirectUrl = new URL(redirectUrl, currentUrl).href;
          }
          console.log(`[Proxy] Following redirect to: ${redirectUrl}`);
          performRequest(redirectUrl, redirectCount + 1);
          return;
        }

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

      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        proxyReq.end();
      } else {
        proxyReq.end(bodyBuffer);
      }
    } catch (err) {
      res.statusCode = 500;
      setCorsHeaders(res);
      res.end(`Internal Proxy Error: ${err.message}`);
    }
  };

  performRequest(targetUrl);
};

module.exports = proxy;

module.exports.config = {
  api: {
    bodyParser: false,
  },
};
