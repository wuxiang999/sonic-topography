import { ListMusic, Trash2 } from 'lucide-react';
import type { NeteaseSong } from '../../../types';

interface SavedPlaylist {
  id: string;
  name: string;
  songs: NeteaseSong[];
}

type PendingDelete =
  | { type: 'song'; playlistId: string; songId: number; label: string }
  | { type: 'playlist'; playlistId: string; label: string };

export function PlaylistPanelContent({
  playlists, activePlaylist, activePlaylistId, setActivePlaylistId,
  currentSongId, loadNeteaseSong, setPendingDelete, playlistsLength, onClose, accentHex
}: {
  playlists: SavedPlaylist[]; activePlaylist: SavedPlaylist | undefined;
  activePlaylistId: string; setActivePlaylistId: (id: string) => void;
  currentSongId: number | null; loadNeteaseSong: (song: NeteaseSong, queue?: NeteaseSong[]) => void;
  setPendingDelete: (pd: PendingDelete) => void; playlistsLength: number;
  onClose: () => void; accentHex: string;
}) {
  return (
    <>
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 text-[12px] uppercase tracking-[0.2em] text-white/70">
            <ListMusic size={15} />
            播放列表
          </div>
          <button onClick={onClose} className="text-[10px] uppercase tracking-[0.15em] text-white/40 hover:text-white">关闭</button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => setActivePlaylistId(playlist.id)}
                className={`flex-shrink-0 px-3 py-2 rounded-sm border text-[10px] uppercase tracking-[0.12em] transition-colors ${activePlaylist?.id === playlist.id ? 'text-black border-transparent' : 'text-white/45 border-white/10 hover:text-white'}`}
                style={{ backgroundColor: activePlaylist?.id === playlist.id ? accentHex : 'transparent' }}
              >
                {playlist.name}
              </button>
            ))}
          </div>
          <button
            onClick={() => activePlaylist && setPendingDelete({ type: 'playlist', playlistId: activePlaylist.id, label: activePlaylist.name })}
            disabled={!activePlaylist || playlistsLength <= 1}
            className="h-8 w-8 flex-shrink-0 rounded-sm border border-white/10 text-white/45 hover:text-[#ef4444] disabled:opacity-20 disabled:hover:text-white/45 flex items-center justify-center"
            title="删除歌单"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="max-h-[52vh] overflow-y-auto">
        {activePlaylist && activePlaylist.songs.length > 0 ? activePlaylist.songs.map((song) => (
          <button
            key={song.id}
            onClick={() => loadNeteaseSong(song, activePlaylist.songs)}
            className="relative w-full text-left px-5 py-4 pr-16 border-b border-white/5 hover:bg-white/5 transition-colors"
          >
            <div className="text-[13px] text-white truncate">{song.name}</div>
            <div className="mt-1 text-[11px] text-white/45 truncate">{song.artist || '未知歌手'} - {song.album || '未知专辑'}</div>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); setPendingDelete({ type: 'song', playlistId: activePlaylist.id, songId: song.id, label: song.name }); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setPendingDelete({ type: 'song', playlistId: activePlaylist.id, songId: song.id, label: song.name }); }
              }}
              className="absolute right-5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-sm border border-white/10 text-white/45 hover:text-[#ef4444] transition-colors flex items-center justify-center"
              title="从歌单移除"
            >
              <Trash2 size={14} />
            </span>
          </button>
        )) : (
          <div className="px-5 py-8 text-[12px] text-white/40">歌单中暂无歌曲</div>
        )}
      </div>
    </>
  );
}
