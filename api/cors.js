const corsProxy = require('cors-anywhere');

// 1. Read and CLEAN the whitelist (remove whitespace and trailing slashes)
const whitelist = process.env.CORSANYWHERE_WHITELIST 
  ? process.env.CORSANYWHERE_WHITELIST.split(',').map(url => url.trim().replace(/\/$/, ''))
  : [];

const proxy = corsProxy.createServer({
    originWhitelist: whitelist,
    requireHeader: [],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PROPFIND', 'PROPPATCH', 'MKCOL', 'COPY', 'MOVE', 'LOCK', 'UNLOCK'],
    allowedHeaders: ['Content-Type', 'Depth', 'Destination', 'If', 'Lock-Token', 'Overwrite', 'Timeout', 'Authorization', 'X-Requested-With', 'Accept', 'Accept-Language'],
    removeHeaders: ['cookie', 'cookie2'],
    setHeaders: {},
    credentials: false
});

module.exports = (req, res) => {
    const url = req.url;
    
    // Handle root path for help page
    if (url === '/' || url === '') {
        proxy.emit('request', req, res);
        return;
    }

    // Just forward everything else. 
    // cors-anywhere will automatically check the originWhitelist 
    // and return the correct CORS headers even for errors.
    proxy.emit('request', req, res);
};
