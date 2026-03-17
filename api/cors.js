const corsProxy = require('cors-anywhere');
const proxy = corsProxy.createServer({
    originWhitelist: ['https://mywebsite.com', 'http://localhost:3000'],
    requireHeader: ['origin', 'x-requested-with'],
    removeHeaders: ['cookie', 'cookie2']
});

module.exports = (req, res) => {
    proxy.emit('request', req, res);
};