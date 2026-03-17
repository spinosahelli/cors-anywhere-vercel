const corsProxy = require('cors-anywhere');
const proxy = corsProxy.createServer({
    originWhitelist: ['http://habit.loc.cc/m', 'https://habit.loc.cc/'],
    requireHeader: ['origin', 'x-requested-with'],
    removeHeaders: ['cookie', 'cookie2']
});
module.exports = (req, res) => {
    console.log('Request received:', req.url); // 这会在 Vercel 日志中显示
    proxy.emit('request', req, res);
};
