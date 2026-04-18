/* page.js — EZDown API integration for all platform SEO pages */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);

  const urlInput     = $('url-input');
  const fetchBtn     = $('fetch-btn');
  const fetchSpinner = $('fetch-spinner');
  const fetchLabel   = $('fetch-label');
  const stepInput    = $('step-input');
  const stepOptions  = $('step-options');
  const stepError    = $('step-error');
  const metaThumb    = $('meta-thumb');
  const metaTitle    = $('meta-title');
  const metaPlatform = $('meta-platform');
  const metaUploader = $('meta-uploader');
  const metaDuration = $('meta-duration');
  const progressTrack= $('progress-track');
  const progressBar  = $('progress-bar');
  const progressLabel= $('progress-label');
  const progressPct  = $('progress-pct');
  const progressStat = $('progress-status');
  const dlBtn        = $('dl-btn');
  const dlLabel      = $('dl-label');
  const errorMsg     = $('error-msg');
  const retryBtn     = $('retry-btn');
  const resetBtn     = $('reset-btn');
  const resetBtn2    = $('reset-btn2');
  const formatSel    = $('format-select');
  const qualitySel   = $('quality-select');
  const subSel       = $('subtitle-select');

  let currentMeta  = null;
  let pollInterval = null;

  if (urlInput)  urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') analyzeUrl(); });
  if (fetchBtn)  fetchBtn.addEventListener('click', analyzeUrl);
  if (dlBtn)     dlBtn.addEventListener('click', startDownload);
  if (resetBtn)  resetBtn.addEventListener('click', reset);
  if (resetBtn2) resetBtn2.addEventListener('click', reset);
  if (retryBtn)  retryBtn.addEventListener('click', reset);

  function show(el)  { if (el) el.style.display = 'block'; }
  function hide(el)  { if (el) el.style.display = 'none'; }

  function showStep(step) {
    hide(stepInput); hide(stepOptions); hide(stepError);
    if (step === 'input')   show(stepInput);
    if (step === 'options') show(stepOptions);
    if (step === 'error')   show(stepError);
  }

  function setLoading(on) {
    if (fetchBtn) fetchBtn.disabled = on;
    if (fetchSpinner) fetchSpinner.classList.toggle('active', on);
    if (fetchLabel) fetchLabel.textContent = on ? 'Analyzing…' : 'Analyze';
  }

  function reset() {
    if (pollInterval) clearInterval(pollInterval);
    currentMeta = null;
    if (urlInput) urlInput.value = '';
    if (progressTrack) progressTrack.style.display = 'none';
    if (progressLabel) progressLabel.style.display = 'none';
    if (progressBar) { progressBar.style.width = '0%'; progressBar.style.background = ''; }
    if (dlBtn) { dlBtn.disabled = false; }
    if (dlLabel) dlLabel.textContent = 'Download Now — Free';
    showStep('input');
    if (urlInput) urlInput.focus();
  }

  async function analyzeUrl() {
    const url = (urlInput && urlInput.value.trim()) || '';
    if (!url || !url.startsWith('http')) {
      if (urlInput) {
        urlInput.style.borderColor = '#e03';
        setTimeout(() => { urlInput.style.borderColor = ''; }, 1500);
      }
      return;
    }
    setLoading(true);
    try {
      const res  = await fetch('/api/info?url=' + encodeURIComponent(url));
      const data = await res.json();
      if (!res.ok) { showErr(data.error || 'Could not fetch video info.'); return; }

      currentMeta = { ...data, url };

      if (metaTitle)    metaTitle.textContent    = data.title    || 'Video';
      if (metaPlatform) metaPlatform.textContent = data.platform || '—';
      if (metaUploader) metaUploader.textContent = data.uploader ? '· @' + data.uploader : '';
      if (metaDuration) metaDuration.textContent = data.duration ? '· ' + data.duration  : '';
      if (metaThumb && data.thumbnail) metaThumb.src = data.thumbnail;

      showStep('options');
    } catch {
      showErr('Network error. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  }

  async function startDownload() {
    if (!currentMeta) return;
    if (dlBtn)  dlBtn.disabled = true;
    if (dlLabel) dlLabel.textContent = 'Starting…';
    if (progressTrack) progressTrack.style.display = 'block';
    if (progressLabel) progressLabel.style.display = 'flex';
    if (progressBar)   progressBar.style.width = '0%';
    if (progressPct)   progressPct.textContent = '0%';
    if (progressStat)  progressStat.textContent = 'Connecting…';

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url:       currentMeta.url,
          format:    formatSel  ? formatSel.value  : 'mp4',
          quality:   qualitySel ? qualitySel.value : 'best',
          subtitles: subSel     ? subSel.value     : 'none'
        })
      });
      const data = await res.json();
      if (!res.ok) { failed(data.error); return; }
      pollJob(data.jobId);
    } catch {
      failed('Network error. Could not contact server.');
    }
  }

  function pollJob(jobId) {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
      try {
        const res  = await fetch('/api/status/' + jobId);
        const data = await res.json();
        const pct  = Math.round(data.progress || 0);

        if (progressBar)  progressBar.style.width = pct + '%';
        if (progressPct)  progressPct.textContent  = pct + '%';

        if (data.status === 'downloading') {
          if (progressStat) progressStat.textContent = 'Downloading…';
          if (dlLabel)      dlLabel.textContent      = 'Downloading ' + pct + '%…';
        } else if (data.status === 'processing') {
          if (progressStat) progressStat.textContent = 'Merging streams…';
          if (dlLabel)      dlLabel.textContent      = 'Processing…';
        } else if (data.status === 'done') {
          clearInterval(pollInterval);
          if (progressBar)  progressBar.style.width   = '100%';
          if (progressBar)  progressBar.style.background = '#43e97b';
          if (progressPct)  progressPct.textContent   = '100%';
          if (progressStat) progressStat.textContent  = 'Done!';
          if (dlLabel)      dlLabel.textContent       = '✓ Saving your file…';
          // Trigger browser download
          const a = document.createElement('a');
          a.href = '/api/file/' + jobId;
          a.download = '';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => {
            if (dlBtn)  dlBtn.disabled = false;
            if (dlLabel) dlLabel.textContent = '↓ Download Again';
          }, 2000);
        } else if (data.status === 'error') {
          clearInterval(pollInterval);
          failed(data.error || 'Download failed.');
        }
      } catch { /* keep polling on network hiccup */ }
    }, 800);
  }

  function showErr(msg) {
    if (errorMsg) errorMsg.textContent = msg;
    showStep('error');
  }

  function failed(msg) {
    if (pollInterval) clearInterval(pollInterval);
    if (dlBtn)  dlBtn.disabled = false;
    if (dlLabel) dlLabel.textContent = 'Download Now — Free';
    if (progressTrack) progressTrack.style.display = 'none';
    if (progressLabel) progressLabel.style.display = 'none';
    showErr(msg || 'Download failed. Please try again.');
  }

  showStep('input');
})();
