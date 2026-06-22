import { useEffect, useState } from 'react';

interface FirstTimeTutorialProps {
  accentHex?: string;
  isMobile?: boolean;
}

interface TipIcon {
  viewBox: string;
  path: string;
}

const DESKTOP_TIPS: { icon: TipIcon; text: string }[] = [
  {
    icon: { viewBox: '0 0 24 24', path: 'M3 3h18v18H3z M9 9h6v6H9z' },
    text: '鼠标悬停屏幕左侧边缘打开侧边栏',
  },
  {
    icon: { viewBox: '0 0 24 24', path: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
    text: '侧边栏可搜索歌曲、管理播放列表',
  },
  {
    icon: { viewBox: '0 0 24 24', path: 'M15 6v12M3 12h18M9 4v16' },
    text: '按 U 键一键隐藏所有界面（含 Logo）',
  },
  {
    icon: { viewBox: '0 0 24 24', path: 'M12 3a1 1 0 00-1 1v1.09A6 6 0 006.09 11H5a1 1 0 000 2h1.09A6 6 0 0011 18.91V20a1 1 0 002 0v-1.09A6 6 0 0017.91 13H19a1 1 0 000-2h-1.09A6 6 0 0013 5.09V4a1 1 0 00-1-1zm0 4a4 4 0 110 8 4 4 0 010-8z' },
    text: '侧边栏进入设置 → 画质 & 抗锯齿可调',
  },
  {
    icon: { viewBox: '0 0 24 24', path: 'M12 15V3m0 12l-4-4m4 4l4-4M2 17l.62 2.48A2 2 0 004 21h16a2 2 0 001.38-.52L22 17' },
    text: '侧边栏最下方进入设置面板',
  },
];

const MOBILE_TIPS: { icon: TipIcon; text: string }[] = [
  {
    icon: { viewBox: '0 0 24 24', path: 'M3 3h18v18H3z M9 9h6v6H9z' },
    text: '点击右下角圆形按钮打开功能菜单',
  },
  {
    icon: { viewBox: '0 0 24 24', path: 'M12 3a1 1 0 00-1 1v1.09A6 6 0 006.09 11H5a1 1 0 000 2h1.09A6 6 0 0011 18.91V20a1 1 0 002 0v-1.09A6 6 0 0017.91 13H19a1 1 0 000-2h-1.09A6 6 0 0013 5.09V4a1 1 0 00-1-1zm0 4a4 4 0 110 8 4 4 0 010-8z' },
    text: '菜单 → 设置 → 画质 & 抗锯齿可调',
  },
  {
    icon: { viewBox: '0 0 24 24', path: 'M12 15V3m0 12l-4-4m4 4l4-4M2 17l.62 2.48A2 2 0 004 21h16a2 2 0 001.38-.52L22 17' },
    text: '设置中可调频段数值显隐、无UI模式',
  },
  {
    icon: { viewBox: '0 0 24 24', path: 'M15 6v12M3 12h18M9 4v16' },
    text: '连接键盘可按 U 键隐藏所有界面',
  },
  {
    icon: { viewBox: '0 0 24 24', path: 'M9 18V5l12-2v13' },
    text: '菜单 → 示例加载演示音乐',
  },
];

const STORAGE_KEY = 'sonic-tutorial-shown';

export function FirstTimeTutorial({ accentHex = '#00ffff', isMobile = false }: FirstTimeTutorialProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const shown = localStorage.getItem(STORAGE_KEY);
    if (!shown) {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const dismiss = () => {
      localStorage.setItem(STORAGE_KEY, '1');
      setVisible(false);
    };
    const handleKey = () => dismiss();
    const handleClick = () => dismiss();
    window.addEventListener('keydown', handleKey);
    window.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('click', handleClick);
    };
  }, [visible]);

  if (!visible) return null;

  const TIPS = isMobile ? MOBILE_TIPS : DESKTOP_TIPS;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" />

      <div
        className="relative border border-white/10 rounded-sm overflow-hidden max-w-[480px] w-[90vw] pointer-events-auto"
        style={{ background: 'rgba(5,10,15,0.96)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 pt-5 pb-4"
          style={{ borderBottom: `1px solid ${accentHex}` }}
        >
          <div className="text-[16px] font-light tracking-[0.08em] text-white/90">
            欢迎{isMobile ? '（移动端）' : ''}
          </div>
        </div>

        {/* Tips */}
        <div>
          {TIPS.map((tip, i) => (
            <div
              key={i}
              className="flex items-center gap-3 py-3 px-4 border-b border-white/5 last:border-b-0"
            >
              <svg
                width="14"
                height="14"
                viewBox={tip.icon.viewBox}
                fill="none"
                stroke={accentHex}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 opacity-60"
              >
                <path d={tip.icon.path} />
              </svg>
              <span className="text-[13px] text-white/80">
                {tip.text}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/5">
          <div className="text-[10px] text-white/30 tracking-[0.05em] text-center">
            点击任意处或按任意键继续
          </div>
        </div>
      </div>
    </div>
  );
}
