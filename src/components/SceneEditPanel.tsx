import React, { useState, useEffect } from 'react';
import { SectionLabel } from './UI';

interface Props {
  nodeId: string | null;
  sceneId: string | null;
  nodes: any[];
  onUpdateScene: (nodeId: string, sceneId: string, updated: any) => void;
  onClose: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  vo: 'Lời thoại (voice-over)',
  setting: 'Bối cảnh',
  subject: 'Nhân vật / chủ thể',
  light: 'Ánh sáng',
  camera: 'Góc máy',
};

const SceneEditPanel: React.FC<Props> = ({ nodeId, sceneId, nodes, onUpdateScene, onClose }) => {
  const node = nodes.find((n) => n.id === nodeId);
  const scenes: any[] = node?.data?.editedScenes ?? [];
  const scene = scenes.find((s) => s.id === sceneId);

  const [jsonDraft, setJsonDraft] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (scene) setJsonDraft(JSON.stringify(scene, null, 2));
    setJsonError(null);
  }, [scene?.id, JSON.stringify(scene)]);

  if (!nodeId || !sceneId || !scene) return null;

  const updateField = (key: string, val: any) => {
    onUpdateScene(nodeId, sceneId, { ...scene, [key]: val });
  };

  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonDraft);
      if (!parsed.id) throw new Error('Thiếu trường "id"');
      onUpdateScene(nodeId, sceneId, parsed);
      setJsonError(null);
    } catch (e: any) {
      setJsonError(e.message || 'JSON không hợp lệ');
    }
  };

  return (
    <div className="absolute top-0 left-0 h-full w-[320px] bg-[#0b1019] border-r border-[#f43f5e]/20 z-[96] flex flex-col shadow-2xl animate-slide-panel-left">
      <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#f43f5e]/10 border border-[#f43f5e]/30 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#f43f5e] text-[16px]">movie_filter</span>
          </div>
          <div>
            <h3 className="text-[9.5px] font-black text-white uppercase tracking-widest leading-none">Sửa Phân Cảnh</h3>
            <p className="text-[7.5px] font-black text-[#94a3b8] uppercase tracking-[0.2em] mt-0.5">{scene.id}</p>
          </div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-[#94a3b8] flex items-center justify-center transition-all border border-white/5">
          <span className="material-symbols-outlined text-[14px]">chevron_left</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-6 pb-8">
        <div className="flex flex-col gap-3">
          <SectionLabel>Thời gian</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[7.5px] text-white/40 uppercase font-black px-0.5">Bắt đầu (s)</label>
              <input
                type="number" step="0.1" value={scene.start}
                onChange={(e) => updateField('start', parseFloat(e.target.value) || 0)}
                className="w-full bg-[#050a10] border border-white/5 hover:border-[#f43f5e]/30 rounded-lg px-2 py-1.5 text-[10px] text-white outline-none font-mono"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[7.5px] text-white/40 uppercase font-black px-0.5">Kết thúc (s)</label>
              <input
                type="number" step="0.1" value={scene.end}
                onChange={(e) => updateField('end', parseFloat(e.target.value) || 0)}
                className="w-full bg-[#050a10] border border-white/5 hover:border-[#f43f5e]/30 rounded-lg px-2 py-1.5 text-[10px] text-white outline-none font-mono"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[7.5px] text-white/40 uppercase font-black px-0.5">Clip (s)</label>
              <input
                type="number" step="1" value={scene.veo}
                onChange={(e) => updateField('veo', parseInt(e.target.value) || 4)}
                className="w-full bg-[#050a10] border border-white/5 hover:border-[#f43f5e]/30 rounded-lg px-2 py-1.5 text-[10px] text-white outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {Object.entries(FIELD_LABELS).map(([key, label]) => (
          <div className="flex flex-col gap-3" key={key}>
            <SectionLabel>{label}</SectionLabel>
            <textarea
              value={scene[key] ?? ''}
              onChange={(e) => updateField(key, e.target.value)}
              className="w-full h-16 bg-[#050a10] border border-white/5 hover:border-[#f43f5e]/30 rounded-xl p-2.5 text-[10px] text-white/90 outline-none transition-all leading-relaxed custom-scrollbar resize-none"
            />
          </div>
        ))}

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <SectionLabel>JSON thô</SectionLabel>
            <button
              onClick={applyJson}
              className="px-2.5 py-1 rounded-lg text-[7.5px] font-black uppercase tracking-widest bg-[#f43f5e]/15 text-[#f43f5e] hover:bg-[#f43f5e]/25 transition-all"
            >
              Áp dụng JSON
            </button>
          </div>
          <textarea
            value={jsonDraft}
            onChange={(e) => setJsonDraft(e.target.value)}
            spellCheck={false}
            className="w-full h-40 bg-black/60 border border-white/5 hover:border-white/10 rounded-xl p-2.5 text-[9.5px] text-white/80 font-mono outline-none transition-all custom-scrollbar leading-relaxed resize-none"
          />
          {jsonError && <p className="text-[9px] text-red-400 leading-relaxed">{jsonError}</p>}
          <p className="text-[9px] text-[#94a3b8] leading-relaxed">
            Sửa trực tiếp JSON rồi bấm "Áp dụng JSON" để ghi đè các trường phía trên — tiện khi copy/dán từ nơi khác.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SceneEditPanel;
