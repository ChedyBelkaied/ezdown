const express  = require('express');
const path     = require('path');
const session  = require('express-session');
const rateLimit= require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const { exec, spawn } = require('child_process');
const fs       = require('fs');
const sanitize = require('sanitize-filename');

const { registerRoutes }        = require('./routes/pages');
const { router: authRouter }    = require('./routes/auth');
const { router: accountRouter } = require('./routes/account');
const { router: billingRouter } = require('./routes/billing');
const { router: pricingRouter } = require('./routes/pricing');
const { requireApiKey }         = require('./middleware/auth');

const app  = express();
const PORT = process.env.PORT || 3000;
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');

function ytdlpAvailable() {
  return new Promise(resolve => {
    exec('python -m yt_dlp --version', err => resolve(!err));
  });
}

if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

// ── Stripe webhook needs raw body — mount BEFORE express.json() ────────────
app.use('/billing/webhook', express.raw({ type: 'application/json' }));

// ── Core middleware ────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Sessions ───────────────────────────────────────────────────────────────
app.use(session({
  secret:            process.env.SECRET_KEY || 'ezdown-dev-secret-change-in-prod',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge:   30 * 24 * 60 * 60 * 1000, // 30 days
  },
}));

// ── Rate limiting (web UI — unauthenticated) ───────────────────────────────
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  skip: (req) => !!req.headers['x-api-key'], // API key users bypass this
  message: { error: 'Too many requests. Please wait.' }
}));

const jobs = {};

// ── Format selector ────────────────────────────────────────────────────────
function buildArgs(url, format, quality, subtitles, outputPath) {
  const args = ['--no-playlist', '--no-warnings', '--newline', '--force-overwrites'];

  if (format === 'mp3' || format === 'audio') {
    args.push('-f', 'bestaudio/best', '-x', '--audio-format', 'mp3', '--audio-quality', '0');
  } else {
    let fmtSelector;
    if (quality === 'best') {
      fmtSelector = [
        'bestvideo[ext=mp4]+bestaudio[ext=m4a]',
        'bestvideo[ext=mp4]+bestaudio',
        'bestvideo+bestaudio[ext=m4a]',
        'bestvideo+bestaudio',
        'best[ext=mp4]',
        'best'
      ].join('/');
    } else {
      const h = parseInt(quality);
      fmtSelector = [
        `bestvideo[height<=${h}][ext=mp4]+bestaudio[ext=m4a]`,
        `bestvideo[height<=${h}][ext=mp4]+bestaudio`,
        `bestvideo[height<=${h}]+bestaudio[ext=m4a]`,
        `bestvideo[height<=${h}]+bestaudio`,
        `best[height<=${h}][ext=mp4]`,
        `best[height<=${h}]`,
        'bestvideo[ext=mp4]+bestaudio[ext=m4a]',
        'bestvideo+bestaudio',
        'best'
      ].join('/');
    }
    args.push('-f', fmtSelector, '--merge-output-format', 'mp4');
  }

  if (subtitles && subtitles !== 'none') {
    args.push('--write-subs', '--embed-subs', '--sub-langs', subtitles);
  }
  args.push('--ffmpeg-location', 'ffmpeg', '-o', outputPath, url);
  return args;
}

// ── Auth + account routes ──────────────────────────────────────────────────
app.use(['/login', '/register', '/logout'], authRouter);
app.use('/account', accountRouter);
app.use('/billing', billingRouter);
app.use('/pricing', pricingRouter);

// ── API routes ─────────────────────────────────────────────────────────────

// Info — supports both browser session and API key
app.get('/api/info', async (req, res) => {
  // API key auth if header present
  if (req.headers['x-api-key'] || req.query.api_key) {
    return requireApiKey(req, res, () => handleInfo(req, res));
  }
  handleInfo(req, res);
});

async function handleInfo(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const ok = await ytdlpAvailable();
  if (!ok) return res.status(503).json({ error: 'yt-dlp not installed' });

  exec(`python -m yt_dlp --dump-json --no-playlist "${url.replace(/"/g, '')}"`,
    { timeout: 30000 },
    (err, stdout) => {
      if (err) return res.status(400).json({ error: 'Could not fetch info. Check the URL.' });
      try {
        const data = JSON.parse(stdout);
        res.json({
          title:    data.title,
          duration: data.duration_string,
          thumbnail:data.thumbnail,
          uploader: data.uploader,
          platform: data.extractor_key,
          view_count:data.view_count,
          formats:  (data.formats || [])
            .filter(f => f.height && f.ext !== 'mhtml')
            .map(f => ({ id: f.format_id, ext: f.ext, height: f.height }))
            .filter((v, i, a) => a.findIndex(t => t.height === v.height) === i)
            .sort((a, b) => b.height - a.height)
        });
      } catch { res.status(500).json({ error: 'Parse error' }); }
    });
}

// Download — supports both browser session and API key
app.post('/api/download', async (req, res) => {
  if (req.headers['x-api-key'] || req.query.api_key) {
    return requireApiKey(req, res, () => handleDownload(req, res));
  }
  handleDownload(req, res);
});

async function handleDownload(req, res) {
  const { url, format = 'mp4', quality = 'best', subtitles = 'none' } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const ok = await ytdlpAvailable();
  if (!ok) return res.status(503).json({ error: 'yt-dlp not installed' });

  const jobId          = uuidv4();
  const outputTemplate = path.join(DOWNLOAD_DIR, `${jobId}.%(ext)s`);

  jobs[jobId] = { status: 'queued', progress: 0, filename: null, error: null, url };
  res.json({ jobId });

  const args = buildArgs(url, format, quality, subtitles, outputTemplate);
  console.log('\n[yt-dlp CMD] python -m yt_dlp', args.join(' '));

  const proc = spawn('python', ['-m', 'yt_dlp', ...args], { windowsHide: true });
  jobs[jobId].status = 'downloading';

  proc.stdout.on('data', chunk => {
    const line = chunk.toString();
    process.stdout.write('[yt-dlp] ' + line);
    const match = line.match(/\[download\]\s+([\d.]+)%/);
    if (match) jobs[jobId].progress = parseFloat(match[1]);
    if (line.includes('[Merger]') || line.includes('[ExtractAudio]') || line.includes('[VideoConvertor]')) {
      jobs[jobId].status   = 'processing';
      jobs[jobId].progress = 99;
    }
  });

  proc.stderr.on('data', chunk => {
    const line = chunk.toString();
    process.stderr.write('[yt-dlp ERR] ' + line);
    if (!jobs[jobId].error && line.toLowerCase().includes('error')) {
      jobs[jobId].error = line.trim();
    }
  });

  proc.on('close', code => {
    try {
      if (code === 0) {
        const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.startsWith(jobId));
        if (files.length) {
          jobs[jobId].filename = files[0];
          jobs[jobId].status   = 'done';
          jobs[jobId].progress = 100;
          console.log('[done] File:', files[0]);
        } else {
          jobs[jobId].status = 'error';
          jobs[jobId].error  = 'Output file not found after download.';
        }
      } else {
        jobs[jobId].status = 'error';
        if (!jobs[jobId].error) jobs[jobId].error = `yt-dlp exited with code ${code}`;
      }
    } catch (e) {
      jobs[jobId].status = 'error';
      jobs[jobId].error  = e.message;
    }
  });
}

app.get('/api/status/:jobId', (req, res) => {
  const job = jobs[req.params.jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ status: job.status, progress: job.progress, error: job.error });
});

app.get('/api/file/:jobId', (req, res) => {
  const job = jobs[req.params.jobId];
  if (!job || job.status !== 'done') return res.status(404).send('Not ready');
  const filePath = path.join(DOWNLOAD_DIR, job.filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('Missing file');
  res.download(filePath);
});

// ── SEO pages + sitemap ────────────────────────────────────────────────────
console.log('\n📄 Registering SEO pages:');
registerRoutes(app);

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Downloads: ${DOWNLOAD_DIR}`);

  if (process.env.RENDER_EXTERNAL_URL) {
    console.log(`🌍 Live URL: ${process.env.RENDER_EXTERNAL_URL}`);
  }

  console.log(`🔑 Dashboard: /account`);
  console.log(`💳 Pricing: /pricing`);

  ytdlpAvailable().then(ok =>
    console.log(ok ? '✅ yt-dlp ready' : '⚠️ yt-dlp not found')
  );
});
