import { useState, useEffect } from 'react';
import { useSettings } from '../../store/SettingsContext';
import type { NeteaseSong } from '../../types';

interface NeteasePlaylist {
  id: number;
  name: string;
  coverImgUrl?: string;
  trackCount: number;
  creator: { nickname: string };
}

interface ApiSong {
  id: number;
  name: string;
  artist: string;
  album: string;
  duration: number;
  fee: number;
  picUrl?: string;
}

export function NeteasePlaylistsPanel({
  onClose,
  onPlaySong,
  accentHex,
}: {
  onClose: () => void;
  onPlaySong: (song: NeteaseSong) => void;
  accentHex: string;
}) {
  const [uid, setUid] = useState<number | null>(null);
  const [playlists, setPlaylists] = useState<NeteasePlaylist[]>([]);
  const [songs, setSongs] = useState<ApiSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'playlists' | 'liked' | 'recommend'>('playlists');
  const [detailPlaylistId, setDetailPlaylistId] = useState<number | null>(null);
  const [detailSongs, setDetailSongs] = useState<ApiSong[]>([]);
  const [error, setError] = useState('');
  const { theme } = useSettings();

  useEffect(() => {
    fetch('/api/netease/account')
      .then(r => r.json())
      .then(data => {
        const id = data.account?.id;
        if (id) setUid(id);
        else setError('无法获取用户信息');
      })
      .catch(() => setError('无法连接服务器'));
  }, []);

  useEffect(() => {
    if (!uid && tab !== 'recommend') return;
    setLoading(true);
    setError('');
    setSongs([]);

    if (tab === 'playlists' && uid) {
      fetch(`/api/netease/user/playlists?uid=${uid}`)
        .then(r => r.json())
        .then(data => {
          setPlaylists(data.playlists || []);
          setLoading(false);
        })
        .catch(() => { setLoading(false); setError('歌单获取失败'); });
    } else if (tab === 'liked' && uid) {
      fetch(`/api/netease/liked?uid=${uid}`)
        .then(r => r.json())
        .then(data => {
          setSongs(data.songs || []);
          setLoading(false);
        })
        .catch(() => { setLoading(false); setError('喜欢歌曲获取失败'); });
    } else if (tab === 'recommend') {
      fetch('/api/netease/recommend')
        .then(r => r.json())
        .then(data => {
          setSongs(data.songs || []);
          setLoading(false);
        })
        .catch(() => { setLoading(false); setError('每日推荐获取失败'); });
    }
  }, [tab, uid]);

  const loadPlaylistDetail = (playlistId: number) => {
    setDetailPlaylistId(playlistId);
    setLoading(true);
    setError('');
    fetch(`/api/netease/playlist?id=${playlistId}`)
      .then(r => r.json())
      .then(data => {
        setDetailSongs(data.songs || []);
        setLoading(false);
      })
      .catch(() => { setLoading(false); setError('歌单详情获取失败'); });
  };

  const bg = theme === 'dark'
    ? 'rgba(2,6,20,0.94)'
    : 'rgba(5,10,20,0.92)';

  if (detailPlaylistId) {
    return (
      <div className="absolute top-[40px] left-[100px] w-[420px] max-h-[74vh] z-50 pointer-events-auto backdrop-blur-[20px] border border-white/[0.08] rounded-sm overflow-hidden" style={{ background: bg }}>
        <div className="absolute top-[1px] left-0 right-0 h-[1px] z-10 pointer-events-none bg-white/[0.04]" />
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <button onClick={() => setDetailPlaylistId(null)} className="text-[9px] uppercase tracking-[0.1em] text-white/40 hover:text-white/70 transition-colors">
            ← 返回
          </button>
          <button onClick={onClose} className="text-[10px] text-white/40 hover:text-white">关闭</button>
        </div>
        <div className="overflow-y-auto max-h-[62vh]">
          {detailSongs.length === 0 && !loading && (
            <div className="p-6 text-center text-[10px] text-white/30">暂无歌曲</div>
          )}
          {detailSongs.map((song) => (
            <div key={song.id}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] cursor-pointer transition-colors border-b border-white/[0.03]"
              onClick={() => onPlaySong({ id: song.id, name: song.name, artist: song.artist, album: song.album, duration: song.duration, fee: song.fee, picUrl: song.picUrl })}
            >
              <div className="w-8 h-8 rounded-sm bg-white/5 flex-shrink-0 overflow-hidden">
                {song.picUrl && <img src={song.picUrl} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-white/80 truncate">{song.name}</div>
                <div className="text-[9px] text-white/40 truncate">{song.artist}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-[40px] left-[100px] w-[420px] max-h-[74vh] z-50 pointer-events-auto backdrop-blur-[20px] border border-white/[0.08] rounded-sm overflow-hidden" style={{ background: bg }}>
      <div className="absolute top-[1px] left-0 right-0 h-[1px] z-10 pointer-events-none bg-white/[0.04]" />
      <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/70">网易云歌单</div>
        <button onClick={onClose} className="text-[10px] text-white/40 hover:text-white">关闭</button>
      </div>
      <div className="flex gap-1 px-4 pt-3 pb-1 border-b border-white/[0.06]">
        <TabButton active={tab === 'playlists'} onClick={() => setTab('playlists')} accent={accentHex}>我的歌单</TabButton>
        <TabButton active={tab === 'liked'} onClick={() => setTab('liked')} accent={accentHex}>喜欢</TabButton>
        <TabButton active={tab === 'recommend'} onClick={() => setTab('recommend')} accent={accentHex}>每日推荐</TabButton>
      </div>
      <div className="overflow-y-auto max-h-[60vh]">
        {error && (
          <div className="p-6 text-center text-[10px] text-white/40">{error}</div>
        )}
        {loading && !error ? (
          <div className="p-6 text-center text-[10px] text-white/30">加载中...</div>
        ) : tab === 'playlists' ? (
          playlists.length === 0 && !error ? (
            <div className="p-6 text-center text-[10px] text-white/30">暂无歌单</div>
          ) : (
            playlists.map((pl) => (
              <div key={pl.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] cursor-pointer transition-colors border-b border-white/[0.03]"
                onClick={() => loadPlaylistDetail(pl.id)}
              >
                <div className="w-10 h-10 rounded-sm bg-white/5 flex-shrink-0 overflow-hidden">
                  {pl.coverImgUrl && <img src={pl.coverImgUrl} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-white/80 truncate">{pl.name}</div>
                  <div className="text-[9px] text-white/40">{pl.trackCount} 首 · {pl.creator?.nickname || ''}</div>
                </div>
              </div>
            ))
          )
        ) : (
          songs.length === 0 && !error ? (
            <div className="p-6 text-center text-[10px] text-white/30">暂无歌曲</div>
          ) : (
            songs.map((song) => (
              <div key={song.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] cursor-pointer transition-colors border-b border-white/[0.03]"
                onClick={() => onPlaySong({ id: song.id, name: song.name, artist: song.artist, album: song.album, duration: song.duration, fee: song.fee, picUrl: song.picUrl })}
              >
                <div className="w-8 h-8 rounded-sm bg-white/5 flex-shrink-0 overflow-hidden">
                  {song.picUrl && <img src={song.picUrl} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-white/80 truncate">{song.name}</div>
                  <div className="text-[9px] text-white/40 truncate">{song.artist}</div>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, accent, children }: { active: boolean; onClick: () => void; accent: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="text-[9px] uppercase tracking-[0.1em] px-2.5 py-1 rounded-sm border transition-all"
      style={{
        backgroundColor: active ? `${accent}20` : 'transparent',
        borderColor: active ? accent : 'rgba(255,255,255,0.08)',
        color: active ? accent : 'rgba(255,255,255,0.45)',
      }}
    >
      {children}
    </button>
  );
}
