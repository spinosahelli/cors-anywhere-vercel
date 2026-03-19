export default async function handler(req, res) {
  // 1. Absolute Permissive CORS Headers
  // We echo back the origin and allow ALL WebDAV methods and headers
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Depth, Destination, If, Lock-Token, Overwrite, Timeout, X-Requested-With, Accept, Accept-Language, Cache-Control');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  res.setHeader('Access-Control-Max-Age', '86400');

  // 2. Handle Preflight (OPTIONS) - The most common failure point
  // The browser sends this BEFORE the real PROPFIND request.
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3. Extract Target URL from the path
  // req.url is usually "/api/https://dav.jianguoyun.com/dav/"
  let targetUrl = req.url.replace(/^\/api\//, '');
  
  // Fix protocol if collapsed (e.g., https:/dav... -> https://dav...)
  if (targetUrl.startsWith('https:/') && !targetUrl.startsWith('https://')) {
    targetUrl = targetUrl.replace('https:/', 'https://');
  } else if (targetUrl.startsWith('http:/') && !targetUrl.startsWith('http://')) {
    targetUrl = targetUrl.replace('http:/', 'http://');
  }

  // If no target is provided, show a status message
  if (!targetUrl || !targetUrl.startsWith('http')) {
    return res.status(200).json({ 
      status: 'Proxy Active', 
      version: '1.2.0',
      info: 'Append your WebDAV URL to the end of this proxy URL.'
    });
  }

  try {
    // 4. Forward Request with all headers (except forbidden ones)
    const headers = {};
    const forbiddenHeaders = ['host', 'connection', 'origin', 'referer', 'content-length'];
    
    Object.keys(req.headers).forEach(key => {
      if (!forbiddenHeaders.includes(key.toLowerCase())) {
        headers[key] = req.headers[key];
      }
    });

    // Forward the request to the real WebDAV server
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      // Only send body for methods that support it (PUT, POST, etc.)
      body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : await req.arrayBuffer(),
      redirect: 'follow'
    });

    // 5. Copy Response Headers back to the browser
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      // Don't copy back headers that might break CORS or encoding
      if (!['access-control-allow-origin', 'content-encoding', 'transfer-encoding', 'connection'].includes(lowerKey)) {
        res.setHeader(key, value);
      }
    });

    // 6. Return the response data
    const data = await response.arrayBuffer();
    res.status(response.status).send(Buffer.from(data));
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Proxy Error', message: error.message });
  }
}
