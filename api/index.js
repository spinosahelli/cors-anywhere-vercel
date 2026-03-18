export default async function handler(req, res) {
  // 1. Set CORS headers for EVERY request
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Depth, Destination, If, Lock-Token, Overwrite, Timeout, X-Requested-With, Accept, Accept-Language');
  res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours

  // 2. Handle Preflight (OPTIONS) immediately
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3. Extract Target URL from the path
  // req.url is usually "/api/https://dav.com/..."
  let targetUrl = req.url.replace(/^\/api\//, '');
  
  // Fix cases where double slashes are collapsed (Vercel sometimes does this)
  if (targetUrl.startsWith('https:/') && !targetUrl.startsWith('https://')) {
    targetUrl = targetUrl.replace('https:/', 'https://');
  } else if (targetUrl.startsWith('http:/') && !targetUrl.startsWith('http://')) {
    targetUrl = targetUrl.replace('http:/', 'http://');
  }

  // Basic validation
  if (!targetUrl || !targetUrl.startsWith('http')) {
    return res.status(400).send('Usage: /api/https://your-webdav-url');
  }

  try {
    // 4. Forward the request to the real WebDAV server
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Authorization': req.headers.authorization || '',
        'Content-Type': req.headers['content-type'] || '',
        'Depth': req.headers.depth || '1',
        'Accept': req.headers.accept || '*/*',
      },
      // Only send body for methods that support it (PUT, POST, etc.)
      body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : await req.arrayBuffer(),
      redirect: 'follow'
    });

    // 5. Copy essential headers back to the browser
    const headersToCopy = ['content-type', 'dav', 'ms-author-via'];
    headersToCopy.forEach(h => {
      const val = response.headers.get(h);
      if (val) res.setHeader(h, val);
    });

    // 6. Return the response data
    const data = await response.arrayBuffer();
    res.status(response.status).send(Buffer.from(data));
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).send('Proxy Error: ' + error.message);
  }
}
