import React from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { toDisplayUrl } from '../../lib/assets';

/**
 * "Vẽ Mạch" — nhận bản thiết kế mạch (text), nhờ AI lên bố cục dạng JSON rồi
 * app tự vẽ ảnh bằng thư viện linh kiện (lib/circuit). Dây luôn gắn đúng chân
 * nên không bị vẽ nhầm như khi để model ảnh tự vẽ. Bố cục JSON lưu lại trong
 * node để sửa tay rồi "Vẽ lại" mà không phải gọi AI lần nữa.
 */
const CircuitDrawNode = ({ id, data }: any) => {
  const { setNodes, deleteElements } = useReactFlow();
  const warnings: string[] = data.circuitWarnings ?? [];

  const onExecute = () => {
    window.dispatchEvent(new CustomEvent('execute-node', { detail: { nodeId: id, mode: 'single', isManual: true } }));
  };

  const onRedraw = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('circuit-redraw', { detail: { nodeId: id } }));
  };

  const onStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('stop-node', { detail: { nodeId: id } }));
  };

  const onPreview = () => {
    if (!data.result?.path) return;
    window.dispatchEvent(new CustomEvent('open-preview', {
      detail: { type: 'image', src: toDisplayUrl(data.result.path), title: data.label || 'Vẽ Mạch' },
    }));
  };

  const onDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('download-node', { detail: { nodeId: id } }));
  };

  const clearResult = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes((nds) => nds.map((n) => n.id === id
      ? { ...n, data: { ...n.data, result: null, isFinalized: false, statusText: '', isLoading: false, lastRunHash: '', circuitWarnings: [] } }
      : n));
  };

  const onOpenSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('open-node-settings', { detail: { nodeId: id } }));
  };

  const onDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('duplicate-node', { detail: { nodeId: id } }));
  };

  const onDeleteNode = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  };

  return (
    <div className="node-container !bg-[#0d1424] !border-[#84cc16]/25 !w-[240px] !p-0 overflow-hidden group/node">
      <div className="p-2.5 border-b border-white/5 flex items-center justify-between bg-[#0b1019]/50">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="material-symbols-outlined text-[#84cc16] text-[16px] shrink-0">electrical_services</span>
          <span className="text-[11px] font-black uppercase tracking-tight text-white truncate">{data.label || 'Vẽ Mạch'}</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={onDuplicate} className="p-1 hover:bg-white/10 rounded-lg text-[#94a3b8] hover:text-[#84cc16] transition-all flex items-center justify-center" title="Nhân bản node">
            <span className="material-symbols-outlined text-[14px]">content_copy</span>
          </button>
          <button onClick={onOpenSettings} className="p-1 hover:bg-white/10 rounded-lg text-[#94a3b8] hover:text-white transition-all flex items-center justify-center" title="Cài đặt node / sửa bố cục JSON">
            <span className="material-symbols-outlined text-[14px]">tune</span>
          </button>
          <button onClick={onDeleteNode} className="p-1 hover:bg-red-500/20 rounded-lg text-[#94a3b8] hover:text-red-400 transition-all flex items-center justify-center" title="Xoá node">
            <span className="material-symbols-outlined text-[14px]">delete</span>
          </button>
        </div>
      </div>

      <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col gap-4 -translate-x-2 pointer-events-none z-50">
        <div className="flex items-center gap-1.5">
          <Handle type="target" position={Position.Left} id="text-in" className="!bg-[#a855f7] !w-4 !h-4 !static !translate-x-0 !border-2 !border-[#0d1424]" />
          <span className="text-[7px] font-black text-white/30 lowercase tracking-[0.1em] -translate-y-[0.5px]">thiết kế</span>
        </div>
      </div>

      <div className="w-full aspect-[4/5] bg-black/60 relative overflow-hidden group/media">
        {data.result?.path ? (
          <>
            <img src={toDisplayUrl(data.result.path)} className="w-full h-full object-cover cursor-zoom-in" alt="" onClick={onPreview} />
            <button onClick={onDownload} className="absolute bottom-1.5 right-1.5 p-1.5 bg-black/70 hover:bg-black text-white rounded-lg opacity-0 group-hover/media:opacity-100 transition-all border border-white/10 flex items-center justify-center" title="Tải ảnh">
              <span className="material-symbols-outlined text-[14px]">download</span>
            </button>
            <button onClick={clearResult} className="absolute top-1.5 right-1.5 p-1.5 bg-black/70 hover:bg-red-600 text-white rounded-lg opacity-0 group-hover/media:opacity-100 transition-all border border-white/10 flex items-center justify-center" title="Xoá kết quả để tạo lại">
              <span className="material-symbols-outlined text-[14px]">delete</span>
            </button>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 opacity-10">
            <span className="material-symbols-outlined text-4xl">electrical_services</span>
            <span className="text-[8px] font-black uppercase tracking-widest text-center">Chờ xử lý</span>
          </div>
        )}

        {(data.isLoading || data.statusText === 'ĐANG CHỜ' || data.statusText === 'ĐÃ DỪNG') && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-10 px-4 text-center">
            <span className="material-symbols-outlined text-[#84cc16] text-xl animate-spin">sync</span>
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-[#84cc16]">{data.statusText || 'Đang vẽ...'}</span>
            {data.isLoading && (
              <button onClick={onStop} className="mt-2 flex items-center gap-1.5 px-3 py-1 bg-[#84cc16] hover:bg-[#65a30d] text-black rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95">
                <span className="material-symbols-outlined text-[14px]">stop_circle</span>
                Dừng
              </button>
            )}
          </div>
        )}
      </div>

      <div className="p-2.5 flex flex-col gap-2">
        {warnings.length > 0 && (
          <div className="nodrag nowheel max-h-24 overflow-auto custom-scrollbar rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 flex flex-col gap-1">
            {warnings.map((w, i) => (
              <span key={i} className="text-[8.5px] text-amber-300 leading-snug">⚠ {w}</span>
            ))}
          </div>
        )}
        <div className="flex gap-1.5">
          <button
            onClick={onExecute}
            disabled={data.isLoading}
            className="flex-1 bg-[#84cc16] hover:bg-[#65a30d] disabled:bg-white/10 disabled:text-white/20 text-black py-2 rounded-xl text-[9.5px] font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 uppercase tracking-[0.1em]"
            title="Gọi AI lên bố cục mới rồi vẽ"
          >
            <span className="material-symbols-outlined text-[16px]">play_arrow</span>
            Vẽ mạch
          </button>
          {data.layoutJson && (
            <button
              onClick={onRedraw}
              disabled={data.isLoading}
              className="px-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white py-2 rounded-xl text-[9px] font-black flex items-center justify-center gap-1 transition-all active:scale-95 uppercase"
              title="Vẽ lại từ bố cục JSON hiện tại (không gọi AI) — dùng sau khi sửa JSON trong Cài đặt"
            >
              <span className="material-symbols-outlined text-[15px]">refresh</span>
            </button>
          )}
        </div>
      </div>

      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center translate-x-2 pointer-events-none z-50">
        <Handle type="source" position={Position.Right} id="media-out" className="!bg-[#84cc16] !w-4 !h-4 !static !translate-x-0 !border-2 !border-[#0d1424]" />
      </div>
    </div>
  );
};

export default CircuitDrawNode;
