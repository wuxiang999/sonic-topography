import { useState, useEffect } from 'react';

export function NeteaseCookieSection({ cookie, onCookieChange, accent }: {
  cookie: string; onCookieChange: (c: string) => void; accent: string;
}) {
  const [localCookie, setLocalCookie] = useState(cookie);
  const [status, setStatus] = useState('');

  useEffect(() => { setLocalCookie(cookie); }, [cookie]);

  return (
    <div>
      <div className="text-[9px] text-white/40 mb-3 leading-relaxed">
        从网易云音乐网站复制你的登录 Cookie，粘贴到下方以启用完整搜索权限（包括喜欢、歌单、每日推荐）。
      </div>

      <textarea
        value={localCookie}
        onChange={(e) => setLocalCookie(e.target.value)}
        placeholder="在此粘贴你的网易云 Cookie..."
        className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2.5 text-[10px] text-white outline-none focus:border-white/30 min-h-[60px] resize-y placeholder:text-white/20 font-mono"
      />

      <div className="flex items-center justify-between mt-2">
        <a href="https://music.163.com" target="_blank" rel="noopener noreferrer"
          className="text-[9px] text-white/30 underline hover:text-white/60">
          打开 music.163.com
        </a>
        <div className="flex items-center gap-2">
          {status && <span className="text-[10px]" style={{ color: accent }}>{status}</span>}
          <button onClick={() => { onCookieChange(localCookie); setStatus('已保存'); setTimeout(() => setStatus(''), 2000); }}
            className="text-[10px] uppercase tracking-[0.15em] px-3 py-1.5 rounded-sm text-black transition-all"
            style={{ backgroundColor: accent }}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
