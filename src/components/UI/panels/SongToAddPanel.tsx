import { Plus } from 'lucide-react';
import type { NeteaseSong } from '../../../types';

interface SavedPlaylist {
  id: string;
  name: string;
  songs: NeteaseSong[];
}

export function SongToAddPanel({
  songToAdd, playlists, newPlaylistName, setNewPlaylistName,
  addSongToPlaylist, createPlaylistAndAddSong, onClose, accentHex
}: {
  songToAdd: NeteaseSong; playlists: SavedPlaylist[];
  newPlaylistName: string; setNewPlaylistName: (v: string) => void;
  addSongToPlaylist: (id: string, song: NeteaseSong) => void;
  createPlaylistAndAddSong: () => void; onClose: () => void; accentHex: string;
}) {
  return (
    <>
      <div className="p-5 border-b border-white/10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/45 mb-2">添加到歌单</div>
            <div className="text-[13px] text-white truncate" title={songToAdd.name}>{songToAdd.name}</div>
          </div>
          <button onClick={onClose} className="text-[10px] uppercase tracking-[0.15em] text-white/40 hover:text-white">关闭</button>
        </div>
      </div>
      <div className="p-3 border-b border-white/10">
        {playlists.map((playlist) => (
          <button
            key={playlist.id}
            onClick={() => addSongToPlaylist(playlist.id, songToAdd)}
            className="w-full flex items-center justify-between gap-3 px-3 py-3 text-left hover:bg-white/5 rounded-sm transition-colors"
          >
            <span className="min-w-0 text-[12px] text-white truncate">{playlist.name}</span>
            <span className="text-[10px] text-white/35">{playlist.songs.length}</span>
          </button>
        ))}
      </div>
      <form className="p-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); createPlaylistAndAddSong(); }}>
        <input
          value={newPlaylistName}
          onChange={(e) => setNewPlaylistName(e.target.value)}
          placeholder="新建歌单"
          className="min-w-0 flex-1 bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-[12px] text-white outline-none focus:border-white/30"
        />
        <button type="submit" className="h-9 w-9 flex-shrink-0 rounded-sm text-black flex items-center justify-center disabled:opacity-50"
          style={{ backgroundColor: accentHex }} disabled={!newPlaylistName.trim()} title="创建歌单">
          <Plus size={15} />
        </button>
      </form>
    </>
  );
}
