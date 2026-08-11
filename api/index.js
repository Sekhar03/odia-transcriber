module.exports = async (req, res) => {
  // CORS Headers for Vercel Serverless Function
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let rawPath = req.url || '/';
    let targetPath = rawPath.startsWith('/api') ? rawPath : `/api${rawPath.startsWith('/') ? '' : '/'}${rawPath}`;
    const renderUrl = `https://odia-transcriber.onrender.com${targetPath}`;

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
    return res.status(500).json({ success: false, error: err.message });
  }
};
