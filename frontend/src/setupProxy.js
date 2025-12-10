const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: process.env.REACT_APP_API_URL || 'http://localhost:5002',
      changeOrigin: true,
      pathRewrite: {
        '^/api': '/api'
      },
      onError: (err, req, res) => {
        console.error('Proxy error:', err.message);
      }
    })
  );
  
  app.use(
    '/socket.io',
    createProxyMiddleware({
      target: process.env.REACT_APP_API_URL || 'http://localhost:5002',
      changeOrigin: true,
      ws: true,
      logLevel: 'error'
    })
  );
};