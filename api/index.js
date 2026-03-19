export default async function handler(req, res) {
  // 1. Absolute Permissive CORS
  // We echo back the origin and allow ALL WebDAV methods and headers
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Depth, Destination, If, Lock-Token, Overwrite, Timeout, X-Requested-With, Accept, Accept-Language, Cache-Control');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  res.setHeader('Access-Control-Max-Age', '86400');

  // 2. Handle Preflight (OPTIONS) - The most common failure point
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3. Extract Target URL
  let targetUrl = req.url.replace(/^\/api\//, '');
  
  // Fix protocol if collapsed (e.g., https:/dav... -> https://dav...)
  if (targetUrl.startsWith('https:/') && !targetUrl.startsWith('https://')) {
    targetUrl = targetUrl.replace('https:/', 'https://');
  } else if (targetUrl.startsWith('http:/') && !targetUrl.startsWith('http://')) {
    targetUrl = targetUrl.replace('http:/', 'http://');
  }

  if (!targetUrl || !targetUrl.startsWith('http')) {
    return res.status(200).json({ status: 'Proxy Active', version: '1.3.0' });
  }

  try {
    // 4. Forward Request with all headers
    const headers = {};
    const forbiddenHeaders = ['host', 'connection', 'origin', 'referer', 'content-length'];
    
    Object.keys(req.headers).forEach(key => {
      if (!forbiddenHeaders.includes(key.toLowerCase())) {
        headers[key] = req.headers[key];
      }
    });

    // Critical: Set a standard User-Agent for Jianguoyun compatibility
    headers['user-agent'] = 'ZenCheck/1.0 (WebDAV Client)';

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : await req.arrayBuffer(),
      redirect: 'follow'
    });

    // 5. Copy Response Headers
    response.headers.forEach((value, key) => {
      if (!['access-control-allow-origin', 'content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    const data = await response.arrayBuffer();
    res.status(response.status).send(Buffer.from(data));
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Proxy Error', message: error.message });
  }
}
