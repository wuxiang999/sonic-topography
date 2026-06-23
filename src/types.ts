// ── Shared types for Sonic Topography ──────────────────────

export interface NeteaseSong {
  id: number;
  name: string;
  artist: string;
  album: string;
  duration: number;
  fee: number;
  picUrl?: string;
}

export type PlayMode = 'sequence' | 'shuffle' | 'repeat-one';
