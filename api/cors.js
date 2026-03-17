const corsProxy = require('cors-anywhere');
const proxy = corsProxy.createServer({
    originWhitelist: ['http://habit.loc.cc/m', 'https://habit.loc.cc/'],
    requireHeader: ['origin', 'x-requested-with'],
    removeHeaders: ['cookie', 'cookie2']
});

module.exports = (req, res) => {
    proxy.emit('request', req, res);
};
