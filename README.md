# EZDown — Universal Media Downloader

A production-ready web application for downloading videos and audio from 1000+ platforms.
Built with **Node.js + Express** on the backend, powered by **yt-dlp** and **FFmpeg**.

---

## ⚡ Quick Start

### 1. Install Dependencies

**Node.js packages:**
```bash
npm install
```

**yt-dlp** (required — the download engine):
```bash
# macOS / Linux (via pip)
pip install yt-dlp

# Or via Homebrew (macOS)
brew install yt-dlp

# Windows — download the .exe from:
# https://github.com/yt-dlp/yt-dlp/releases/latest
# Place yt-dlp.exe somewhere in your PATH
```

**FFmpeg** (required — for merging video+audio streams):
```bash
# macOS
brew install ffmpeg

# Ubuntu / Debian
sudo apt install ffmpeg

# Windows — download from https://ffmpeg.org/download.html
# Extract and add the /bin folder to your PATH
```

### 2. Run the Server

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

Open your browser at → **http://localhost:3000**

---

## 📁 Project Structure

```
ezdown/
├── server.js          ← Express backend (API + file serving)
├── package.json
├── downloads/         ← Temp folder for processed files (auto-created)
│
└── public/
    ├── index.html     ← Single-page frontend
    ├── css/
    │   └── style.css  ← All styles
    └── js/
        └── app.js     ← Frontend logic (fetch, poll, download)
```

---

## 🔌 API Reference

### `GET /api/info?url=<URL>`
Fetch video metadata before downloading.

**Response:**
```json
{
  "title": "Video Title",
  "duration": "3:45",
  "thumbnail": "https://...",
  "uploader": "Channel Name",
  "platform": "Youtube",
  "formats": [
    { "id": "137", "ext": "mp4", "height": 1080, "fps": 30 }
  ]
}
```

---

### `POST /api/download`
Start a background download job.

**Body:**
```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "format": "mp4",
  "quality": "1080",
  "subtitles": "none"
}
```

**Format options:** `mp4`, `webm`, `mp3`  
**Quality options:** `best`, `2160`, `1080`, `720`, `480`, `360`  
**Subtitles options:** `none`, `en`, `fr`, `ar`, `de`, `es`, `pt`, `it`, `zh`, `ja`, `ko`

**Response:**
```json
{ "jobId": "uuid-here" }
```

---

### `GET /api/status/:jobId`
Poll the status of a download job.

**Response:**
```json
{
  "status": "downloading",
  "progress": 42.3,
  "error": null
}
```

**Status values:** `queued` → `downloading` → `processing` → `done` | `error`

---

### `GET /api/file/:jobId`
Stream the finished file to the browser as a download.

Returns the file as `Content-Disposition: attachment`.  
File is automatically deleted from the server after **10 minutes**.

---

## ⚙️ Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |

Set via environment variable:
```bash
PORT=8080 npm start
```

---

## 🔒 Security & Privacy

- Files are stored temporarily in `/downloads/` and auto-deleted after 10 minutes
- Rate limiting: 20 API requests per minute per IP
- Filenames are sanitized before delivery
- No user accounts, no tracking, no logging of URLs

---

## 🌐 Supported Platforms

Over 1000 platforms via yt-dlp, including:

YouTube · TikTok · Instagram · Twitter/X · Facebook · Twitch · Dailymotion · Vimeo · Reddit · SoundCloud · Bilibili · Rumble · Odysee · Niconico · Pinterest · and many more.

Full list: https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md

---

## 🚀 Deploy to Production

### With PM2 (recommended)
```bash
npm install -g pm2
pm2 start server.js --name ezdown
pm2 save
pm2 startup
```

### With Docker
```dockerfile
FROM node:20-alpine
RUN apk add --no-cache python3 py3-pip ffmpeg && pip3 install yt-dlp
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

### With Nginx reverse proxy
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_read_timeout 300s;
        client_max_body_size 0;
    }
}
```

---

## 🛠️ Troubleshooting

**"yt-dlp is not installed"**  
→ Run `yt-dlp --version` in your terminal to verify. Install via pip or Homebrew.

**"Download failed"**  
→ Some URLs are age-restricted or private. yt-dlp may need cookies for those.

**FFmpeg not found**  
→ Run `ffmpeg -version` to verify. Add the bin folder to your system PATH.

**File not found after download**  
→ Files expire after 10 minutes. Download immediately after the job completes.

---

Built on [yt-dlp](https://github.com/yt-dlp/yt-dlp) + [FFmpeg](https://ffmpeg.org) + [Express](https://expressjs.com)
