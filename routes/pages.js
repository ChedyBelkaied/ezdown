// routes/pages.js — SEO landing pages for each platform
const fs   = require('fs');
const path = require('path');

const SITE = 'https://saveitall.online'; // ← change to your domain

// ── Platform configs ──────────────────────────────────────────────────────────
const PLATFORMS = {
  'tiktok-video-downloader': {
    name:        'TikTok',
    accentColor: '#ff2d55',
    slug:        'tiktok-video-downloader',
    navActive:   'NAV_TIKTOK',
    metaTitle:   'TikTok Video Downloader — Download TikTok Without Watermark | SaveitAll',
    metaDesc:    'Download TikTok videos without watermark for free. No app needed, no sign-up. Paste any TikTok link and save HD videos in MP4 or MP3 in seconds.',
    h1:          'TikTok Video Downloader<br><em>Without Watermark</em>',
    heroDesc:    'Paste any TikTok link and download the video in HD — no watermark, no account, no app required. Works on every device.',
    placeholder: 'Paste TikTok link here... (https://www.tiktok.com/@user/video/...)',
    features: [
      { icon: '🚫', title: 'No Watermark',    desc: 'Download clean TikTok videos with no TikTok logo or watermark.' },
      { icon: '📱', title: 'All Devices',      desc: 'Works on iPhone, Android, Windows and Mac without any app.' },
      { icon: '⚡', title: 'Fast Download',    desc: 'Our servers process TikTok videos in seconds.' },
      { icon: '🎵', title: 'MP3 Extraction',  desc: 'Extract the audio from any TikTok video as high-quality MP3.' },
      { icon: '🔒', title: 'Private & Secure', desc: 'We never store your links. Files are deleted after 10 minutes.' },
      { icon: '🆓', title: 'Completely Free',  desc: 'No account, no subscription. Download as many videos as you want.' },
    ],
    faqs: [
      { q: 'How do I download a TikTok video without watermark?',    a: 'Copy the TikTok video link, paste it above, click Analyze, then Download. The video is saved in HD without any TikTok watermark.' },
      { q: 'Is SaveitAll TikTok Downloader free?',                      a: 'Yes, completely free. No account, no app, no subscription required.' },
      { q: 'Can I download TikTok videos on iPhone or Android?',     a: 'Yes. SaveitAll works in any mobile browser — Safari, Chrome, Firefox. No app needed.' },
      { q: 'What formats can I download TikTok videos in?',          a: 'MP4 (video + audio) or MP3 (audio only). HD and SD quality options are available.' },
      { q: 'Can I download private TikTok videos?',                  a: 'No. SaveitAll only works with publicly available TikTok videos.' },
      { q: 'Is it legal to download TikTok videos?',                 a: 'For personal offline viewing, yes. Do not re-upload or redistribute content you do not own.' },
    ],
    schemaRating: { value: '4.8', count: '12400' },
  },

  'youtube-video-downloader': {
    name:        'YouTube',
    accentColor: '#ff0000',
    slug:        'youtube-video-downloader',
    navActive:   'NAV_YOUTUBE',
    metaTitle:   'YouTube Video Downloader — Download YouTube Videos Free | SaveitAll',
    metaDesc:    'Download YouTube videos in HD, 4K, MP4 or MP3 for free. No account needed. Paste any YouTube link and save it instantly with SaveitAll.',
    h1:          'YouTube Video Downloader<br><em>HD, 4K & MP3</em>',
    heroDesc:    'Download any YouTube video in the highest quality available — 4K, 1080p, 720p, or audio-only MP3. Free, fast, no account required.',
    placeholder: 'Paste YouTube link here... (https://www.youtube.com/watch?v=...)',
    features: [
      { icon: '4K',  title: '4K & HD Quality', desc: 'Download in the highest quality available, up to 4K UHD.' },
      { icon: '🎵', title: 'YouTube to MP3',   desc: 'Extract audio from any YouTube video as a high-quality MP3.' },
      { icon: '📋', title: 'Playlist Support', desc: 'Download individual videos from any playlist in seconds.' },
      { icon: '⚡', title: 'Fast Processing',  desc: 'FFmpeg merges video and audio streams server-side for you.' },
      { icon: '🔒', title: 'No Tracking',      desc: 'Your URLs are never logged. Files auto-delete after 10 minutes.' },
      { icon: '🆓', title: 'Always Free',       desc: 'No limits, no watermarks, no sign-up required.' },
    ],
    faqs: [
      { q: 'How do I download a YouTube video?',                 a: 'Copy the YouTube video URL, paste it in the field above, select quality, click Analyze then Download.' },
      { q: 'Can I download YouTube videos in 4K?',              a: 'Yes. SaveitAll supports up to 4K (2160p) when the video is available in that quality.' },
      { q: 'How do I convert YouTube to MP3?',                  a: 'Select "MP3 Audio" in the Format dropdown before clicking Analyze. The audio will be extracted at maximum quality.' },
      { q: 'Is it free to download YouTube videos?',            a: 'Yes, SaveitAll is completely free. No account or subscription needed.' },
      { q: 'Can I download age-restricted YouTube videos?',     a: 'Age-restricted videos require authentication and cannot be downloaded by SaveitAll.' },
      { q: 'Is downloading YouTube videos legal?',              a: 'For personal offline use, generally yes. Do not redistribute copyrighted content.' },
    ],
    schemaRating: { value: '4.9', count: '45000' },
  },

  'instagram-video-downloader': {
    name:        'Instagram',
    accentColor: '#e1306c',
    slug:        'instagram-video-downloader',
    navActive:   'NAV_INSTAGRAM',
    metaTitle:   'Instagram Video Downloader — Download Instagram Reels & Videos Free | SaveitAll',
    metaDesc:    'Download Instagram videos, Reels and Stories for free. No login needed. Paste any Instagram link to save HD videos instantly with SaveitAll.',
    h1:          'Instagram Video Downloader<br><em>Reels, Stories & Videos</em>',
    heroDesc:    'Download Instagram Reels, videos and Stories in HD quality. No Instagram login, no app required. Works on all devices.',
    placeholder: 'Paste Instagram link here... (https://www.instagram.com/reel/...)',
    features: [
      { icon: '🎬', title: 'Reels & Videos',   desc: 'Download Instagram Reels, feed videos, and IGTV in HD.' },
      { icon: '📱', title: 'No Login Needed',  desc: 'Download public Instagram videos without logging in.' },
      { icon: '⚡', title: 'Instant Save',     desc: 'Your file is ready in seconds, delivered straight to your device.' },
      { icon: '🎵', title: 'Audio Extract',    desc: 'Save just the audio from any Instagram video as MP3.' },
      { icon: '🔒', title: 'Private & Safe',   desc: 'No data stored, no cookies, no tracking.' },
      { icon: '🆓', title: '100% Free',         desc: 'No subscription or account required, ever.' },
    ],
    faqs: [
      { q: 'How do I download an Instagram Reel?',             a: 'Open Instagram, copy the Reel link, paste it above, click Analyze then Download.' },
      { q: 'Can I download Instagram Stories?',                a: 'Yes, public Stories are supported. Private accounts require the user to be public.' },
      { q: 'Do I need an Instagram account to download?',     a: 'No. SaveitAll downloads public content without any Instagram login.' },
      { q: 'Can I download private Instagram videos?',        a: 'No. Only publicly accessible videos can be downloaded.' },
      { q: 'What quality are downloaded Instagram videos?',   a: 'SaveitAll downloads the highest available quality, usually 1080p for Reels.' },
      { q: 'Is downloading Instagram videos legal?',          a: 'For personal use only. Never re-post content you do not own without permission.' },
    ],
    schemaRating: { value: '4.7', count: '9800' },
  },

  'youtube-to-mp3': {
    name:        'YouTube',
    accentColor: '#1db954',
    slug:        'youtube-to-mp3',
    navActive:   'NAV_MP3',
    metaTitle:   'YouTube to MP3 Converter — Free, Fast, High Quality | SaveitAll',
    metaDesc:    'Convert any YouTube video to MP3 for free. High quality 320kbps audio. No account needed. Paste your YouTube link and download MP3 in seconds.',
    h1:          'YouTube to MP3<br><em>Free Converter</em>',
    heroDesc:    'Convert any YouTube video to high-quality MP3 audio instantly. 320kbps, free, no account required. Works on all devices.',
    placeholder: 'Paste YouTube link here... (https://www.youtube.com/watch?v=...)',
    features: [
      { icon: '🎧', title: '320kbps Quality',  desc: 'Maximum audio quality extraction from any YouTube video.' },
      { icon: '⚡', title: 'Fast Conversion',   desc: 'MP3 files are ready in seconds, no waiting in queue.' },
      { icon: '📱', title: 'All Devices',       desc: 'Works on iPhone, Android, Windows, Mac — any browser.' },
      { icon: '🎵', title: 'Any Genre',         desc: 'Music, podcasts, lectures, audiobooks — any YouTube audio.' },
      { icon: '🔒', title: 'No Storage',        desc: 'Files auto-delete after 10 minutes. Your privacy is protected.' },
      { icon: '🆓', title: 'Always Free',        desc: 'Unlimited conversions, no account, no watermark on audio.' },
    ],
    faqs: [
      { q: 'How do I convert YouTube to MP3?',                a: 'Paste your YouTube URL above, make sure MP3 is selected as the format, click Analyze then Download.' },
      { q: 'What bitrate is the MP3?',                        a: 'SaveitAll extracts audio at the maximum available quality, up to 320kbps.' },
      { q: 'Can I download YouTube Music as MP3?',            a: 'Standard YouTube videos work. YouTube Music may be restricted depending on the content.' },
      { q: 'Is the YouTube to MP3 converter free?',           a: 'Yes, completely free with no limit on conversions.' },
      { q: 'How long does the conversion take?',              a: 'Usually 5-30 seconds depending on video length and server load.' },
      { q: 'Is it legal to convert YouTube to MP3?',         a: 'For personal offline use of content you own or that is royalty-free. Do not distribute copyrighted music.' },
    ],
    schemaRating: { value: '4.8', count: '28000' },
  },
};

// ── Template renderer ─────────────────────────────────────────────────────────
function renderPage(slug) {
  const p = PLATFORMS[slug];
  if (!p) return null;

  const layout = fs.readFileSync(
    path.join(__dirname, '../public/pages/_layout.html'), 'utf8'
  );

  // Build features HTML
  const featuresHTML = p.features.map(f => `
    <div class="feature-item">
      <div class="feature-icon">${f.icon}</div>
      <div><h3>${f.title}</h3><p>${f.desc}</p></div>
    </div>`).join('');

  // Build FAQ HTML
  const faqHTML = p.faqs.map(f => `
    <details>
      <summary>${f.q}</summary>
      <div class="faq-answer">${f.a}</div>
    </details>`).join('');

  // Schema — WebApplication
  const schemaWebApp = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: `SaveitAll ${p.name} Downloader`,
    url: `${SITE}/${slug}`,
    description: p.metaDesc,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: p.schemaRating.value,
      reviewCount: p.schemaRating.count,
    },
  });

  // Schema — BreadcrumbList
  const schemaBreadcrumb = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
      { '@type': 'ListItem', position: 2, name: `${p.name} Downloader`, item: `${SITE}/${slug}` },
    ],
  });

  // Schema — FAQPage
  const schemaFaq = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: p.faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  });

  // Nav active class
  const navKeys = ['NAV_TIKTOK', 'NAV_YOUTUBE', 'NAV_INSTAGRAM', 'NAV_MP3'];
  let html = layout
    .replace(/\{\{CANONICAL\}\}/g,      `${SITE}/${slug}`)
    .replace(/\{\{META_TITLE\}\}/g,     p.metaTitle)
    .replace(/\{\{META_DESC\}\}/g,      p.metaDesc)
    .replace(/\{\{H1\}\}/g,             p.h1)
    .replace(/\{\{HERO_DESC\}\}/g,      p.heroDesc)
    .replace(/\{\{PLATFORM_NAME\}\}/g,  p.name)
    .replace(/\{\{ACCENT_COLOR\}\}/g,   p.accentColor)
    .replace(/\{\{INPUT_PLACEHOLDER\}\}/g, p.placeholder)
    .replace(/\{\{FEATURES_HTML\}\}/g,  featuresHTML)
    .replace(/\{\{FAQ_HTML\}\}/g,       faqHTML)
    .replace(/\{\{SCHEMA_WEBAPP\}\}/g,  schemaWebApp)
    .replace(/\{\{SCHEMA_BREADCRUMB\}\}/g, schemaBreadcrumb)
    .replace(/\{\{SCHEMA_FAQ\}\}/g,     schemaFaq);

  // Set nav active
  navKeys.forEach(k => {
    html = html.replace(`{{${k}}}`, k === p.navActive ? 'class="active"' : '');
  });

  return html;
}

// ── Express router ────────────────────────────────────────────────────────────
function registerRoutes(app) {
  Object.keys(PLATFORMS).forEach(slug => {
    app.get('/' + slug, (req, res) => {
      const html = renderPage(slug);
      if (!html) return res.status(404).send('Page not found');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      // Cache for 1 hour on CDN (Cloudflare etc.)
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
      res.send(html);
    });
    console.log(`  📄 /${slug}`);
  });

  // Sitemap.xml — helps Google discover all pages
  app.get('/sitemap.xml', (req, res) => {
    const urls = [
      `<url><loc>${SITE}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
      ...Object.keys(PLATFORMS).map(s =>
        `<url><loc>${SITE}/${s}</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>`
      ),
    ].join('\n  ');

    res.setHeader('Content-Type', 'application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls}
</urlset>`);
  });

  // Robots.txt
  app.get('/robots.txt', (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(`User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml`);
  });
}

module.exports = { registerRoutes, PLATFORMS };
