const express  = require('express');
const path     = require('path');
const session  = require('express-session');
const rateLimit= require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const { exec, spawn } = require('child_process');
const fs       = require('fs');
const sanitize = require('sanitize-filename');
const ffmpegPath = require('ffmpeg-static');

const { registerRoutes }        = require('./routes/pages');
const { router: authRouter }    = require('./routes/auth');
const { router: accountRouter } = require('./routes/account');
const { router: billingRouter } = require('./routes/billing');
const { router: pricingRouter } = require('./routes/pricing');
const { requireApiKey }         = require('./middleware/auth');

const app  = express();
const PORT = process.env.PORT || 3000;
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
const FFMPEG_DIR   = path.dirname(ffmpegPath);

// ── Cookies — Render Secret Files stocke dans /etc/secrets/cookies.txt ──────
// En local on cherche cookies.txt à la racine du projet
const COOKIES_FILE = fs.existsSync('/etc/secrets/cookies.txt')
  ? '/etc/secrets/cookies.txt'
  : path.join(__dirname, 'cookies.txt');

function hasCookies() {
  try {
    return fs.existsSync(COOKIES_FILE) && fs.statSync(COOKIES_FILE).size > 50;
  } catch { return false; }
}

function ytdlpAvailable() {
  return new Promise(resolve => {
    exec('python -m yt_dlp --version', { timeout: 10000 }, err => resolve(!err));
  });
}

if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

app.use('/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret:            process.env.SECRET_KEY || 'ezdown-dev-secret-change-in-prod',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge:   30 * 24 * 60 * 60 * 1000,
  },
}));

app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  skip: (req) => !!req.headers['x-api-key'],
  message: { error: 'Too many requests. Please wait.' }
}));

const jobs = {};

// ── buildArgs — injecte --cookies si disponible ───────────────────────────
function buildArgs(url, format, quality, subtitles, outputPath, playerClient) {
 const args = [
  '--no-playlist',
  '--no-warnings',
  '--newline',
  '--force-overwrites',

  '--geo-bypass',
  '--force-ipv4',

  '--add-header', 'User-Agent:Mozilla/5.0'
];

  // Cookies = contournement blocage datacenter YouTube
  if (hasCookies()) {
  args.push('--cookies', COOKIES_FILE);
} else {
  console.log('⚠️ No cookies → high risk of block');
}

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

  args.push('--ffmpeg-location', FFMPEG_DIR, '-o', outputPath, url);
  return args;
}

app.use(['/login', '/register', '/logout'], authRouter);
app.use('/account', accountRouter);
app.use('/billing', billingRouter);
app.use('/pricing', pricingRouter);

// ── /api/info — cascade player_client + cookies ───────────────────────────
app.get('/api/info', async (req, res) => {
  if (req.headers['x-api-key'] || req.query.api_key) {
    return requireApiKey(req, res, () => handleInfo(req, res));
  }
  handleInfo(req, res);
});

async function handleInfo(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const ok = await ytdlpAvailable();
  if (!ok) return res.status(503).json({ error: 'yt-dlp not installed. Run: pip install yt-dlp' });

  const clients    = ['android', 'ios', 'web', 'mweb', 'tv_embedded'];
  const cookieFlag = hasCookies() ? `--cookies "${COOKIES_FILE}"` : '';

  function tryClient(i) {
    if (i >= clients.length) {
      const hint = hasCookies()
        ? 'Your cookies may have expired — re-export them from your browser and update the Secret File on Render.'
        : 'Add your YouTube cookies as a Secret File named cookies.txt on Render.';
      return res.status(400).json({ error: `YouTube is blocking datacenter requests. ${hint}` });
    }

    const client  = clients[i];
    const safeUrl = url.replace(/"/g, '').replace(/`/g, '');
    const cmd = `python -m yt_dlp --dump-json --no-playlist ${cookieFlag} --geo-bypass --force-ipv4 --extractor-args "youtube:player_client=${client}" "${safeUrl}"`;

    console.log(`[info] client=${client} | cookies=${hasCookies()}`);

    exec(cmd, { timeout: 60000 }, (err, stdout, stderr) => {
      if (err) {
        const errText = (stderr || err.message || '').toLowerCase();
        console.error(`[info] client=${client} FAILED →`, (stderr || '').trim().split('\n').pop());

        // Erreur de blocage → essayer le client suivant
        if (
          errText.includes('reload')             ||
          errText.includes('player_client')      ||
          errText.includes('sign in to confirm') ||
          errText.includes('not a bot')          ||
          errText.includes('confirm your age')
        ) {
          return tryClient(i + 1);
        }

        // Erreurs permanentes
        const msg =
          errText.includes('private video')      ? 'This video is private.'                   :
          errText.includes('sign in')             ? 'This video requires a YouTube login.'     :
          errText.includes('not available')       ? 'Video not available in your region.'      :
          errText.includes('video unavailable')   ? 'Video unavailable.'                       :
          'Could not fetch video info. Check the URL.';

        return res.status(400).json({ error: msg });
      }

      try {
        const firstLine = stdout.trim().split('\n')[0];
        const data      = JSON.parse(firstLine);
        console.log(`[info] ✅ client=${client} — "${data.title}"`);
        res.json({
          title:      data.title,
          duration:   data.duration_string,
          thumbnail:  data.thumbnail,
          uploader:   data.uploader,
          platform:   data.extractor_key,
          view_count: data.view_count,
          formats:    (data.formats || [])
            .filter(f => f.height && f.ext !== 'mhtml')
            .map(f => ({ id: f.format_id, ext: f.ext, height: f.height }))
            .filter((v, i, a) => a.findIndex(t => t.height === v.height) === i)
            .sort((a, b) => b.height - a.height)
        });
      } catch (parseErr) {
        console.error('[info] Parse error:', parseErr.message);
        res.status(500).json({ error: 'Parse error. Make sure the URL is a direct video link.' });
      }
    });
  }

  tryClient(0);
}

// ── /api/download ─────────────────────────────────────────────────────────
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

  const args = buildArgs(url, format, quality, subtitles, outputTemplate, 'android');
  console.log('\n[download] Starting:', url.slice(0, 70));
  console.log('[download] cookies:', hasCookies() ? COOKIES_FILE : 'none');

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
          console.log('[done]', files[0]);
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

console.log('\n📄 Registering SEO pages:');
registerRoutes(app);

app.listen(PORT, () => {
  console.log(`\n🚀 EZDown → http://localhost:${PORT}`);
  console.log(`📁 Downloads: ${DOWNLOAD_DIR}`);
  console.log(`🔧 FFmpeg:    ${FFMPEG_DIR}`);
  console.log(`🍪 Cookies:   ${hasCookies() ? COOKIES_FILE + ' ✅' : 'NOT FOUND ⚠️'}`);
  if (process.env.RENDER_EXTERNAL_URL) {
    console.log(`🌍 Live URL:  ${process.env.RENDER_EXTERNAL_URL}`);
  }
  console.log(`🔑 Dashboard: /account`);
  console.log(`💳 Pricing:   /pricing\n`);
  ytdlpAvailable().then(ok =>
    console.log(ok ? '✅ yt-dlp ready' : '⚠️  yt-dlp not found — run: pip install yt-dlp')
  );
});
