/* ── EZDown Frontend App ─────────────────────────────────────────────────── */
(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────────────────
  let currentJobId = null;
  let pollInterval = null;
  let currentVideoMeta = null;
  let downloadHistory = JSON.parse(localStorage.getItem('ezdown_history') || '[]');

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const urlInput     = document.getElementById('url-input');
  const fetchBtn     = document.getElementById('fetch-btn');
  const fetchSpinner = document.getElementById('fetch-spinner');
  const fetchLabel   = document.getElementById('fetch-label');

  const stepInput    = document.getElementById('step-input');
  const stepOptions  = document.getElementById('step-options');
  const stepError    = document.getElementById('step-error');

  const metaThumb    = document.getElementById('meta-thumb');
  const metaTitle    = document.getElementById('meta-title');
  const metaPlatform = document.getElementById('meta-platform');
  const metaUploader = document.getElementById('meta-uploader');
  const metaDuration = document.getElementById('meta-duration');
  const resetBtn     = document.getElementById('reset-btn');

  const formatSel    = document.getElementById('format-select');
  const qualitySel   = document.getElementById('quality-select');
  const subSel       = document.getElementById('subtitle-select');

  const progressSec  = document.getElementById('progress-section');
  const progressBar  = document.getElementById('progress-bar');
  const progressPct  = document.getElementById('progress-pct');
  const progressStat = document.getElementById('progress-status');

  const dlBtn        = document.getElementById('dl-btn');
  const dlLabel      = document.getElementById('dl-label');

  const errorMsg     = document.getElementById('error-msg');
  const retryBtn     = document.getElementById('retry-btn');

  const historyList  = document.getElementById('history-list');
  const historyEmpty = document.getElementById('history-empty');
  const clearHistBtn = document.getElementById('clear-history-btn');

  // ── Init ──────────────────────────────────────────────────────────────────
  renderHistory();

  urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') analyzeUrl(); });
  fetchBtn.addEventListener('click', analyzeUrl);
  resetBtn.addEventListener('click', resetToInput);
  retryBtn.addEventListener('click', resetToInput);
  dlBtn.addEventListener('click', startDownload);
  clearHistBtn.addEventListener('click', clearHistory);

  // ── Step helpers ──────────────────────────────────────────────────────────
  function showStep(step) {
    stepInput.classList.add('hidden');
    stepOptions.classList.add('hidden');
    stepError.classList.add('hidden');
    if (step === 'input')   stepInput.classList.remove('hidden');
    if (step === 'options') stepOptions.classList.remove('hidden');
    if (step === 'error')   stepError.classList.remove('hidden');
  }

  function resetToInput() {
    clearPoll();
    currentJobId = null;
    currentVideoMeta = null;
    urlInput.value = '';
    progressSec.classList.add('hidden');
    progressBar.style.width = '0%';
    dlBtn.disabled = false;
    dlLabel.textContent = 'Download Now';
    showStep('input');
    urlInput.focus();
  }

  function setFetchLoading(loading) {
    fetchBtn.disabled = loading;
    fetchSpinner.classList.toggle('active', loading);
    fetchLabel.textContent = loading ? 'Analyzing…' : 'Analyze';
  }

  // ── Analyze URL ───────────────────────────────────────────────────────────
  async function analyzeUrl() {
    const url = urlInput.value.trim();
    if (!url) { shake(urlInput); return; }
    if (!isValidUrl(url)) { showError('Please enter a valid URL (must start with http:// or https://)'); return; }

    setFetchLoading(true);
    try {
      const res = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!res.ok) { showError(data.error || 'Failed to fetch video info.'); return; }

      currentVideoMeta = { ...data, url };
      populateMeta(data);
      populateQualities(data.formats || []);
      showStep('options');
    } catch (err) {
      showError('Network error. Is the server running?');
    } finally {
      setFetchLoading(false);
    }
  }

  function populateMeta(data) {
    metaTitle.textContent    = data.title    || 'Untitled';
    metaPlatform.textContent = data.platform || 'Unknown';
    metaUploader.textContent = data.uploader || '';
    metaDuration.textContent = data.duration || '';
    if (data.thumbnail) {
      metaThumb.src = data.thumbnail;
      metaThumb.onerror = () => { metaThumb.style.display = 'none'; };
    }
  }

  function populateQualities(formats) {
    qualitySel.innerHTML = '';
    const opt = (val, txt) => { const o = document.createElement('option'); o.value = val; o.textContent = txt; return o; };
    qualitySel.appendChild(opt('best', '⚡ Best available'));
    const heights = [...new Set(formats.map(f => f.height).filter(Boolean))].sort((a,b)=>b-a);
    const labels = {2160:'4K — 2160p',1080:'Full HD — 1080p',720:'HD — 720p',480:'SD — 480p',360:'Low — 360p'};
    heights.forEach(h => { if (labels[h]) qualitySel.appendChild(opt(String(h), labels[h])); });
    if (!heights.length) {
      [1080,720,480,360].forEach(h => qualitySel.appendChild(opt(String(h), labels[h])));
    }
  }

  // ── Start Download ────────────────────────────────────────────────────────
  async function startDownload() {
    if (!currentVideoMeta) return;
    const format   = formatSel.value;
    const quality  = qualitySel.value;
    const subtitles = subSel.value;

    dlBtn.disabled = true;
    dlLabel.textContent = 'Starting…';
    progressSec.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressPct.textContent = '0%';
    progressStat.textContent = 'Connecting…';

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: currentVideoMeta.url, format, quality, subtitles })
      });
      const data = await res.json();
      if (!res.ok) { downloadFailed(data.error || 'Download failed.'); return; }

      currentJobId = data.jobId;
      pollJob(currentJobId, format);
    } catch {
      downloadFailed('Network error. Could not contact server.');
    }
  }

  function pollJob(jobId, format) {
    clearPoll();
    pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/status/${jobId}`);
        const data = await res.json();

        if (data.status === 'downloading') {
          const pct = Math.round(data.progress);
          progressBar.style.width = pct + '%';
          progressPct.textContent = pct + '%';
          progressStat.textContent = 'Downloading…';
          dlLabel.textContent = `Downloading ${pct}%…`;
        } else if (data.status === 'processing') {
          progressBar.style.width = '99%';
          progressPct.textContent = '99%';
          progressStat.textContent = 'Merging streams with FFmpeg…';
          dlLabel.textContent = 'Processing…';
        } else if (data.status === 'done') {
          clearPoll();
          progressBar.style.width = '100%';
          progressBar.style.background = 'var(--accent3)';
          progressPct.textContent = '100%';
          progressStat.textContent = 'Done! Preparing your file…';
          dlLabel.textContent = '✓ Done! Downloading…';
          // Auto-trigger file download
          triggerFileDownload(jobId, format);
          addToHistory({ jobId, format, quality: qualitySel.value, meta: currentVideoMeta });
        } else if (data.status === 'error') {
          clearPoll();
          downloadFailed(data.error || 'Download failed.');
        }
      } catch {
        // Network hiccup, keep polling
      }
    }, 800);
  }

  function triggerFileDownload(jobId, format) {
    const a = document.createElement('a');
    a.href = `/api/file/${jobId}`;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => {
      dlBtn.disabled = false;
      dlLabel.textContent = '↓ Download Again';
    }, 2000);
  }

  function downloadFailed(msg) {
    clearPoll();
    errorMsg.textContent = msg;
    showStep('error');
  }

  function clearPoll() {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  }

  // ── History ───────────────────────────────────────────────────────────────
  function addToHistory(entry) {
    downloadHistory.unshift({
      jobId: entry.jobId,
      title: entry.meta.title || 'Unknown',
      platform: entry.meta.platform || '?',
      thumbnail: entry.meta.thumbnail || '',
      format: entry.format,
      quality: entry.quality,
      ts: Date.now()
    });
    if (downloadHistory.length > 30) downloadHistory.pop();
    localStorage.setItem('ezdown_history', JSON.stringify(downloadHistory));
    renderHistory();
  }

  function renderHistory() {
    historyList.innerHTML = '';
    if (!downloadHistory.length) {
      historyList.appendChild(historyEmpty);
      historyEmpty.classList.remove('hidden');
      return;
    }
    downloadHistory.forEach(item => {
      const badgeClass = { mp4:'badge-mp4', mp3:'badge-mp3', webm:'badge-webm' }[item.format] || 'badge-mp4';
      const badgeText  = { mp4:'MP4', mp3:'MP3', webm:'WebM' }[item.format] || item.format.toUpperCase();
      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML = `
        <img class="hi-thumb" src="${escHtml(item.thumbnail)}" alt="" onerror="this.style.display='none'" />
        <div class="hi-info">
          <div class="hi-title">${escHtml(item.title)}</div>
          <div class="hi-meta">${escHtml(item.platform)} · ${badgeText} ${escHtml(item.quality)} · ${timeAgo(item.ts)}</div>
        </div>
        <span class="hi-badge ${badgeClass}">${badgeText}</span>
        <a class="hi-dl-link" href="/api/file/${item.jobId}" download>↓ Re-download</a>
      `;
      historyList.appendChild(div);
    });
  }

  function clearHistory() {
    downloadHistory = [];
    localStorage.removeItem('ezdown_history');
    renderHistory();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function showError(msg) { errorMsg.textContent = msg; showStep('error'); }

  function isValidUrl(s) {
    try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function shake(el) {
    el.style.animation = 'none';
    el.offsetHeight; // reflow
    el.style.animation = 'shake .35s ease';
    el.addEventListener('animationend', () => { el.style.animation = ''; }, { once: true });
    el.style.borderColor = 'var(--accent2)';
    setTimeout(() => { el.style.borderColor = ''; }, 1500);
  }

  function timeAgo(ts) {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
    if (d > 0) return `${d}d ago`;
    if (h > 0) return `${h}h ago`;
    if (m > 0) return `${m}m ago`;
    return 'just now';
  }

  // Shake animation
  const style = document.createElement('style');
  style.textContent = '@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}';
  document.head.appendChild(style);

})();
