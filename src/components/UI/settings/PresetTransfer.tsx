import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { createPresetTransferPackage, writePresetTransferPackage } from '../../../lib/presetTransfer';
import type { PresetTransferPackage } from '../../../lib/presetTransfer';

export function PresetTransfer({ accent }: { accent: string }) {
  const [includeCookie, setIncludeCookie] = useState(false);
  const [importStatus, setImportStatus] = useState('');

  const handleExport = () => {
    try {
      const preset = createPresetTransferPackage({ includeNeteaseCookie: includeCookie });
      const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sonic-topography-preset-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setImportStatus('导出成功');
      setTimeout(() => setImportStatus(''), 2000);
    } catch (e) {
      setImportStatus('导出失败');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as PresetTransferPackage;
        writePresetTransferPackage(parsed);
        setImportStatus('导入成功！页面将刷新以应用设置。');
        setTimeout(() => window.location.reload(), 1500);
      } catch {
        setImportStatus('导入失败：文件格式无效');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div>
      <div className="text-[9px] text-white/40 mb-3 leading-relaxed">
        导出或导入所有设置（主题、EQ、触发器、歌单等）。这是备份和迁移配置的最佳方式。
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={handleExport}
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] px-3 py-2 rounded-sm border transition-all"
          style={{ borderColor: `${accent}40`, color: accent, backgroundColor: `${accent}10` }}>
          <Download size={12} />
          导出预设
        </button>

        <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] px-3 py-2 rounded-sm border border-white/10 text-white/60 hover:text-white cursor-pointer transition-colors">
          <Upload size={12} />
          导入预设
          <input type="file" accept=".json" onChange={handleImport} className="hidden" />
        </label>
      </div>

      <label className="flex items-center gap-2 mt-2 cursor-pointer">
        <input type="checkbox" checked={includeCookie} onChange={(e) => setIncludeCookie(e.target.checked)}
          className="w-3 h-3 rounded-sm border-white/20"
          style={{ accentColor: accent }} />
        <span className="text-[9px] text-white/40">包含网易云 Cookie（敏感信息，谨慎分享）</span>
      </label>

      {importStatus && (
        <div className="mt-2 text-[10px] animate-pulse" style={{ color: importStatus.includes('成功') ? accent : '#ef4444' }}>
          {importStatus}
        </div>
      )}
    </div>
  );
}
