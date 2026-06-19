import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 4173);
const dataDir = path.join(__dirname, 'data');
const playlistsPath = path.join(dataDir, 'playlists.json');
const PHP_API = process.env.PHP_API_URL || 'http://localhost:8080/api/music.php';

// Cache for song URLs: id -> { url, expiresAt }
const urlCache = new Map();
const URL_CACHE_TTL = 1000 * 60 * 30; // 30 minutes

// Cache for search results
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
    const raw = await fs.readFile(playlistsPath, 'utf8');
    return normalizePlaylists(JSON.parse(raw));
  } catch (error) {
    return createDefaultPlaylists();
  }
}

async function writePlaylistsFile(playlists) {
  await fs.mkdir(dataDir, { recursive: true });
  const normalized = normalizePlaylists(playlists);
  await fs.writeFile(playlistsPath, JSON.stringify(normalized, null, 2), 'utf8');
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
// Maps song metadata to visual style hints for the player's adaptive theme system

function classifySongStyle(song) {
  const name = (song.name || '').toLowerCase();
  const artist = (song.artists || song.artist || '').toLowerCase();
  const duration = song.duration || 0;
  const seconds = duration / 1000;

  // Pre-classified artists with style profiles
  const artistProfiles = [
    // Rock / intense
    { names: ['beyond', '五月天', '涅槃', 'nirvana', 'queen', 'linkin park', 
              'metallica', 'green day', '崔健', '黑豹', '唐朝', '汪峰', '许巍',
              '伍佰', 'guns n', 'ac/dc', 'rammstein', 'slipknot'], style: 'rock' },
    // Ballad / lyrical
    { names: ['陈百强', '陈慧娴',  '王菲', '邓丽君', '蔡琴', '齐豫', '周华健', 
              '罗大佑', '李宗盛', '孟庭苇', '刘若英', '张雨生', '赵传',
              '林忆莲', '张信哲', '任贤齐', '陈升', '陈绮贞', '张悬',
              '刘德华', '张学友', '郭富城', '黎明', '谭咏麟', '张国荣',
              '梅艳芳', '叶倩文', '林志炫', '周传雄', '游鸿明', '熊天平',
              '苏芮', '潘越云', '辛晓琪', '万芳', '黄莺莺', '凤飞飞',
              '费玉清', '蔡幸娟', '李翊君', '陈淑桦', '徐小凤', '关淑怡'], style: 'ballad' },
    // Electronic / dance
    { names: ['alan walker', 'daft punk', 'skrillex', 'avicii', 'marshmello',
              '蔡依林', '罗百吉', 'deadmau5', 'martin garrix', 'the chainsmokers',
              'kraftwerk', 'depeche mode'], style: 'electronic' },
    // Ambient / instrumental
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

  // Duration-based heuristics (more than 5 min → likely ballad, less than 2.5 min → likely upbeat)
  if (seconds > 300) return 'ballad';
  if (seconds < 150) return 'upbeat';

  // Name keyword matching
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

  return 'pop'; // default
}

// ==================== PHP API PROXY (full songs, no 30s preview) ====================

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

    const apiUrl = `${PHP_API}?type=search&keywords=${encodeURIComponent(keywords)}&limit=${limit * 3}`;
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });

    if (!response.ok) throw new Error(`PHP API search failed: ${response.status}`);

    const body = await response.json();
    const rawSongs = body?.data?.songs || [];

    // Map PHP API format → frontend format with style classification
    const songs = rawSongs.map((song) => ({
      id: song.id,
      name: song.name,
      artist: song.artists || '',
      album: song.album || '',
      duration: song.duration || 0,
      picUrl: song.picUrl || '',
      style: classifySongStyle(song),        // ← new: visual style hint
      genre: song.genre || '',               // ← passthrough: Netease genre if available
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

    const apiUrl = `${PHP_API}?type=lyric&id=${encodeURIComponent(id)}`;
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });

    if (!response.ok) throw new Error(`Lyric API failed: ${response.status}`);

    const body = await response.json();
    res.json({
      lyric: body?.data?.lrc?.lyric || '',
      translatedLyric: body?.data?.tlyric?.lyric || '',
    });
  } catch (error) {
    console.error('Lyric error:', error);
    res.status(500).json({ error: '歌词获取失败' });
  }
});

// Song URL (for preloading check)
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

    const apiUrl = `${PHP_API}?type=url&id=${encodeURIComponent(id)}`;
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });

    if (!response.ok) throw new Error(`URL API failed: ${response.status}`);

    const body = await response.json();
    const url = body?.data?.data?.[0]?.url || null;

    if (url) {
      urlCache.set(id, { url, expiresAt: Date.now() + URL_CACHE_TTL });
    }

    res.json({ url });
  } catch (error) {
    console.error('URL error:', error);
    res.status(500).json({ error: '获取播放地址失败' });
  }
});

// Audio proxy (streams the actual audio through Express to avoid mixed content)
app.get('/api/netease/audio', async (req, res) => {
  try {
    const id = String(req.query.id || '');
    if (!id) {
      res.status(400).json({ error: '缺少歌曲ID' });
      return;
    }

    // Get URL from cache or PHP API
    const cached = urlCache.get(id);
    let playableUrl = cached?.expiresAt > Date.now() ? cached.url : null;

    if (!playableUrl) {
      const apiUrl = `${PHP_API}?type=url&id=${encodeURIComponent(id)}`;
      const response = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`URL API failed: ${response.status}`);

      const body = await response.json();
      playableUrl = body?.data?.data?.[0]?.url || null;

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

// Serve static audio files (outside dist/ so builds don't wipe them)
const staticAudioDir = path.join(__dirname, 'static-audio');
app.use('/static-audio', express.static(staticAudioDir));

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Sonic Topography is running at http://127.0.0.1:${port}`);
});
