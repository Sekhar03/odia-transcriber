const app = require('../server');

module.exports = async (req, res) => {
  // Proxy Vercel API calls to persistent Render server to bypass Vercel 10s execution limits
  if (req.url.startsWith('/api/')) {
    try {
      const renderUrl = `https://odia-transcriber.onrender.com${req.url}`;
      const options = {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };

      if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
        options.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }

      const proxyRes = await fetch(renderUrl, options);
      const contentType = proxyRes.headers.get('content-type') || '';

      res.status(proxyRes.status);
      if (contentType.includes('application/pdf')) {
        const arrayBuffer = await proxyRes.arrayBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', proxyRes.headers.get('content-disposition') || 'attachment; filename="transcript.pdf"');
        return res.send(Buffer.from(arrayBuffer));
      } else {
        const data = await proxyRes.json();
        return res.json(data);
      }
    } catch (err) {
      console.error('[Vercel Proxy Error]', err.message);
      // Fallback to local express app execution if proxy fails
      return app(req, res);
    }
  }

  return app(req, res);
};
