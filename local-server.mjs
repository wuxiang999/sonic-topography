import express from 'express';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 4173);
const dataDir = path.join(__dirname, 'data');
const playlistsPath = path.join(dataDir, 'playlists.json');

// ==================== NETEASE EAPI CRYPTO ====================
// Ported from PHP (getMusicapi.php) — AES-128-ECB + MD5 signing
const AES_KEY = 'e82ckenh8dichen8';

// Load Netease cookies: 1) env var 2) api/cookie.txt 3) defaults
function loadNeteaseCookies() {
  const defaults = { os: 'pc', appver: '', osver: '', deviceId: 'pyncm!' };

  if (process.env.NETEASE_COOKIE) {
    return { ...defaults, ...parseCookieStr(process.env.NETEASE_COOKIE) };
  }

  const cookiePath = path.join(__dirname, 'api', 'cookie.txt');
  try {
    const cookieContent = fs.readFileSync(cookiePath, 'utf8').trim();
    return { ...defaults, ...parseCookieStr(cookieContent) };
  } catch {
    return defaults; // No cookie — search/lyric still work, URL needs auth
  }
}

function parseCookieStr(str) {
  const cookies = {};
  str.split(';').forEach((pair) => {
    const eq = pair.indexOf('=');
    if (eq > 0) cookies[pair.substring(0, eq).trim()] = pair.substring(eq + 1).trim();
  });
  return cookies;
}

let neteaseCookies = loadNeteaseCookies();
// Re-load cookie on SIGHUP (for hot-reload after updating cookie.txt)
process.on('SIGHUP', () => { neteaseCookies = loadNeteaseCookies(); console.log('[netease] cookies reloaded'); });

function pkcs7Pad(buf, blockSize) {
  const pad = blockSize - (buf.length % blockSize);
  return Buffer.concat([buf, Buffer.alloc(pad, pad)]);
}

function aesEncrypt(data, key = AES_KEY) {
  const cipher = crypto.createCipheriv('aes-128-ecb', Buffer.from(key), null);
  const padded = pkcs7Pad(Buffer.from(data, 'utf-8'), 16);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(padded), cipher.final()]);
}

/** Build the encrypted params for Netease EAPI (interface3.music.163.com/eapi/...) */
function eapiEncrypt(urlPath, payload) {
  const url2 = urlPath.replace('/eapi/', '/api/');
  const jsonPayload = JSON.stringify(payload);
  const digest = crypto.createHash('md5').update(`nobody${url2}use${jsonPayload}md5forencrypt`).digest('hex');
  const params = `${url2}-36cd479b6b5-${jsonPayload}-36cd479b6b5-${digest}`;
  return aesEncrypt(params).toString('hex');
}

/** POST to Netease EAPI endpoint */
async function neteasePost(urlPath, payload, extraCookies = {}) {
  const url = `https://interface3.music.163.com${urlPath}`;
  const encrypted = eapiEncrypt(urlPath, payload);
  const allCookies = { ...neteaseCookies, ...extraCookies };
  const cookieStr = Object.entries(allCookies).map(([k, v]) => `${k}=${v}`).join('; ');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36 Chrome/91.0.4472.164 NeteaseMusicDesktop/2.10.2.200154',
      'Referer': '',
      'Cookie': cookieStr,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ params: encrypted }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) throw new Error(`Netease API error: ${response.status}`);
  return response.json();
}

/** POST to regular Netease API (no encryption) */
async function neteaseSimplePost(url, data, extraCookies = {}) {
  const allCookies = { ...neteaseCookies, ...extraCookies };
  const cookieStr = Object.entries(allCookies).map(([k, v]) => `${k}=${v}`).join('; ');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36',
      'Referer': 'https://music.163.com/',
      'Cookie': cookieStr,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(data),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) throw new Error(`Netease simple POST failed: ${response.status}`);
  return response.json();
}

/** GET from regular Netease API (no encryption) */
async function neteaseSimpleGet(url, extraCookies = {}) {
  const allCookies = { ...neteaseCookies, ...extraCookies };
  const cookieStr = Object.entries(allCookies).map(([k, v]) => `${k}=${v}`).join('; ');

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36',
      'Referer': 'https://music.163.com/',
      'Cookie': cookieStr,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) throw new Error(`Netease simple GET failed: ${response.status}`);
  return response.json();
}

// ==================== NETEASE IMAGE URL ====================
/** Encrypt image ID → Netease CDN URL (ported from PHP encryptId + getPicUrl) */
function neteasePicUrl(picId, size = 300) {
  const magic = '3go8&$8*3*3h0k(2)2';
  const idStr = String(picId);
  let xored = '';
  for (let i = 0; i < idStr.length; i++) {
    xored += String.fromCharCode(idStr.charCodeAt(i) ^ magic.charCodeAt(i % magic.length));
  }
  const md5Bytes = crypto.createHash('md5').update(xored).digest();
  const encId = md5Bytes.toString('base64').replace(/[/+]/g, (c) => (c === '/' ? '_' : '-'));
  return `https://p3.music.126.net/${encId}/${picId}.jpg?param=${size}y${size}`;
}

// ==================== CACHES ====================
const urlCache = new Map();
const URL_CACHE_TTL = 1000 * 60 * 30;
const searchCache = new Map();
const SEARCH_CACHE_TTL = 1000 * 60 * 5;

const app = express();
app.use(express.json({ limit: '1mb' }));

// ==================== PLAYLIST HANDLING ====================
function createDefaultPlaylists() {
  return [
    { id: 'favorites', name: '收藏', songs: [] },
    { id: 'visual-set', name: '视觉集', songs: [] },
  ];
}

function normalizePlaylists(value) {
  if (!Array.isArray(value) || value.length === 0) return createDefaultPlaylists();
  return value.map((playlist) => ({
    id: String(playlist.id || `playlist-${Date.now()}`),
    name: String(playlist.name || 'Playlist'),
    songs: Array.isArray(playlist.songs) ? playlist.songs : [],
  }));
}

async function readPlaylistsFile() {
  try {
    const raw = await fsPromises.readFile(playlistsPath, 'utf8');
    return normalizePlaylists(JSON.parse(raw));
  } catch (error) {
    return createDefaultPlaylists();
  }
}

async function writePlaylistsFile(playlists) {
  await fsPromises.mkdir(dataDir, { recursive: true });
  const normalized = normalizePlaylists(playlists);
  await fsPromises.writeFile(playlistsPath, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

app.get('/api/playlists', async (_req, res) => {
  res.json({ playlists: await readPlaylistsFile() });
});

app.put('/api/playlists', async (req, res) => {
  try {
    const playlists = await writePlaylistsFile(req.body?.playlists);
    res.json({ playlists });
  } catch (error) {
    res.status(500).json({ error: '无法保存歌单' });
  }
});

// ==================== MUSIC STYLE CLASSIFICATION ====================
function classifySongStyle(song) {
  const name = (song.name || '').toLowerCase();
  const artist = (song.artists || song.artist || '').toLowerCase();
  const duration = song.duration || 0;
  const seconds = duration / 1000;

  const artistProfiles = [
    { names: ['beyond', '五月天', '涅槃', 'nirvana', 'queen', 'linkin park',
              'metallica', 'green day', '崔健', '黑豹', '唐朝', '汪峰', '许巍',
              '伍佰', 'guns n', 'ac/dc', 'rammstein', 'slipknot'], style: 'rock' },
    { names: ['陈百强', '陈慧娴', '王菲', '邓丽君', '蔡琴', '齐豫', '周华健',
              '罗大佑', '李宗盛', '孟庭苇', '刘若英', '张雨生', '赵传',
              '林忆莲', '张信哲', '任贤齐', '陈升', '陈绮贞', '张悬',
              '刘德华', '张学友', '郭富城', '黎明', '谭咏麟', '张国荣',
              '梅艳芳', '叶倩文', '林志炫', '周传雄', '游鸿明', '熊天平',
              '苏芮', '潘越云', '辛晓琪', '万芳', '黄莺莺', '凤飞飞',
              '费玉清', '蔡幸娟', '李翊君', '陈淑桦', '徐小凤', '关淑怡'], style: 'ballad' },
    { names: ['alan walker', 'daft punk', 'skrillex', 'avicii', 'marshmello',
              '蔡依林', '罗百吉', 'deadmau5', 'martin garrix', 'the chainsmokers',
              'kraftwerk', 'depeche mode'], style: 'electronic' },
    { names: ['久石让', '坂本龙一', 'yanni', '班得瑞', '林海', '石进',
              '赵海洋', 'yiruma', 'ludovico', 'max richter', 'olafur',
              'nils frahm', '钢琴', '古筝', '二胡', '琵琶', '笛子',
              '萧', '古琴', '马友友', '神秘园', 'secret garden'], style: 'ambient' },
  ];

  for (const profile of artistProfiles) {
    for (const n of profile.names) {
      if (artist.includes(n)) return profile.style;
    }
  }

  if (seconds > 300) return 'ballad';
  if (seconds < 150) return 'upbeat';

  const balladKws = ['情歌', '月亮', '温柔', '爱你', '吻别', '眼泪', '哭沙',
                     '梦', '回忆', '浪漫', '传奇', '一生', '永远', '月亮',
                     '心', '雨', '夜', '海', '花', '风', '云', '相思'];
  const upbeatKws = ['跳', '舞', '动', '快', '跑', '飞', '燃烧', '热烈',
                     'party', 'high', '摇滚', '节奏', '青春', '奔放'];

  for (const kw of balladKws) {
    if (name.includes(kw)) return 'ballad';
  }
  for (const kw of upbeatKws) {
    if (name.includes(kw)) return 'upbeat';
  }

  return 'pop';
}

// ==================== NETEASE DIRECT API (no PHP needed) ====================

// Search
app.get('/api/netease/search', async (req, res) => {
  try {
    const keywords = String(req.query.keywords || '').trim();
    const limit = Math.min(Number(req.query.limit) || 12, 20);

    if (!keywords) {
      res.status(400).json({ error: '请输入搜索关键词' });
      return;
    }

    const cacheKey = `${keywords.toLowerCase()}::${limit}`;
    const cached = searchCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.json({ songs: cached.songs, cached: true });
      return;
    }

    const payload = {
      s: keywords, type: 1, limit: limit * 3, offset: 0,
      header: JSON.stringify({ os: 'pc', appver: '', osver: '', deviceId: 'pyncm!', requestId: String(Math.floor(Math.random() * 1e7 + 2e7)) }),
    };
    const result = await neteasePost('/eapi/cloudsearch/pc', payload);
    const rawSongs = result?.result?.songs || [];

    const songs = rawSongs.map((item) => ({
      id: item.id,
      name: item.name,
      artist: (item.ar || []).map((a) => a.name).filter(Boolean).join(' / '),
      album: item.al?.name || '',
      duration: item.dt || 0,
      picUrl: item.al?.picUrl ? neteasePicUrl(item.al.pic, 300) : '',
      style: classifySongStyle({ name: item.name, artists: (item.ar || []).map((a) => a.name).join(' / '), duration: item.dt }),
    })).slice(0, limit);

    searchCache.set(cacheKey, { songs, expiresAt: Date.now() + SEARCH_CACHE_TTL });
    res.json({ songs });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: '搜索失败' });
  }
});

// Lyric
app.get('/api/netease/lyric', async (req, res) => {
  try {
    const id = String(req.query.id || '');
    if (!id) {
      res.status(400).json({ error: '缺少歌曲ID' });
      return;
    }

    const payload = {
      id, cp: 'false', tv: '0', lv: '0', rv: '0', kv: '0', yv: '0', ytv: '0', yrv: '0',
      header: JSON.stringify({ os: 'pc', appver: '', osver: '', deviceId: 'pyncm!', requestId: String(Math.floor(Math.random() * 1e7 + 2e7)) }),
    };
    const result = await neteasePost('/eapi/song/lyric', payload);
    res.json({
      lyric: result?.lrc?.lyric || '',
      translatedLyric: result?.tlyric?.lyric || '',
    });
  } catch (error) {
    console.error('Lyric error:', error);
    res.status(500).json({ error: '歌词获取失败' });
  }
});

// Song URL
app.get('/api/netease/url', async (req, res) => {
  try {
    const id = String(req.query.id || '');
    if (!id) {
      res.status(400).json({ error: '缺少歌曲ID' });
      return;
    }

    const cached = urlCache.get(id);
    if (cached && cached.expiresAt > Date.now()) {
      res.json({ url: cached.url });
      return;
    }

    const level = String(req.query.level || 'standard');
    const payload = {
      ids: [id], level, encodeType: 'flac',
      header: JSON.stringify({ os: 'pc', appver: '', osver: '', deviceId: 'pyncm!', requestId: String(Math.floor(Math.random() * 1e7 + 2e7)) }),
    };
    const result = await neteasePost('/eapi/song/enhance/player/url/v1', payload);
    const url = result?.data?.[0]?.url || null;

    if (url) {
      urlCache.set(id, { url, expiresAt: Date.now() + URL_CACHE_TTL });
    }

    res.json({ url });
  } catch (error) {
    console.error('URL error:', error);
    res.status(500).json({ error: '获取播放地址失败' });
  }
});

// Audio proxy (stream audio through to avoid mixed content / CORS issues)
app.get('/api/netease/audio', async (req, res) => {
  try {
    const id = String(req.query.id || '');
    if (!id) {
      res.status(400).json({ error: '缺少歌曲ID' });
      return;
    }

    const cached = urlCache.get(id);
    let playableUrl = cached?.expiresAt > Date.now() ? cached.url : null;

    if (!playableUrl) {
      const level = String(req.query.level || 'standard');
      const payload = {
        ids: [id], level, encodeType: 'flac',
        header: JSON.stringify({ os: 'pc', appver: '', osver: '', deviceId: 'pyncm!', requestId: String(Math.floor(Math.random() * 1e7 + 2e7)) }),
      };
      const result = await neteasePost('/eapi/song/enhance/player/url/v1', payload);
      playableUrl = result?.data?.[0]?.url || null;
      if (playableUrl) {
        urlCache.set(id, { url: playableUrl, expiresAt: Date.now() + URL_CACHE_TTL });
      }
    }

    if (!playableUrl) {
      res.status(404).json({ error: '该歌曲暂无可用播放源' });
      return;
    }

    const headers = {
      Referer: 'https://music.163.com/',
      'User-Agent': 'Mozilla/5.0',
    };
    if (req.headers.range) headers.Range = req.headers.range;

    const audioResponse = await fetch(playableUrl, { headers, signal: AbortSignal.timeout(30000) });
    res.status(audioResponse.status);

    ['content-type', 'content-length', 'content-range', 'accept-ranges'].forEach((header) => {
      const value = audioResponse.headers.get(header);
      if (value) res.setHeader(header, value);
    });

    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'audio/mpeg');

    if (audioResponse.body) {
      const reader = audioResponse.body.getReader();
      const pump = async () => {
        try {
          const { done, value } = await reader.read();
          if (done) { res.end(); return; }
          res.write(Buffer.from(value), pump);
        } catch (err) {
          if (!res.headersSent) res.end();
        }
      };
      pump();
    } else {
      res.end();
    }
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: '音频流代理失败' });
    }
  }
});

// ==================== STATIC & SPA ====================

const staticAudioDir = path.join(__dirname, 'static-audio');
app.use('/static-audio', express.static(staticAudioDir));

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Sonic Topography is running at http://127.0.0.1:${port}`);
  console.log(`  Netease API: built-in (no external server needed)`);
  console.log(`  Playlist data: ${playlistsPath}`);
});