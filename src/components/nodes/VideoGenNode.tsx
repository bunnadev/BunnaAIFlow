import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Handle, Position, useReactFlow, useEdges, useNodes } from 'reactflow';
import { toDisplayUrl } from '../../lib/assets';

const VideoGenNode = ({ id, data }: any) => {
const { setNodes, setEdges, deleteElements } = useReactFlow();
const edges = useEdges();
const nodes = useNodes();
const [showRunOptions, setShowRunOptions] = useState(false);
const optionsRef = useRef<HTMLDivElement>(null);

const incomingMedia = useMemo(() => {
return edges
.filter(e => e.target === id && e.targetHandle === 'media-in')
.map(edge => {
const srcNode = nodes.find(n => n.id === edge.source);
if (!srcNode) return null;
const srcData = srcNode.data as any;
const mediaData = srcData.result || srcData.media;
return {
id: srcNode.id,
edgeId: edge.id,
path: mediaData?.path,
type: mediaData?.type || 'image',
label: srcData.label
};
})
.filter(item => item !== null);
}, [edges, nodes, id]);

const isFrameLimitExceeded = data.videoMode === 'frame' && incomingMedia.filter(m => m.type === 'image').length > 2;

const clearResult = (e: React.MouseEvent) => {
e.stopPropagation();
setNodes((nds) =>
nds.map((node) =>
node.id === id
? {
...node,
data: {
...node.data,
result: null,
isFinalized: false,
statusText: '',
isLoading: false,
lastRunHash: ''
}
}
: node
)
);
};

const hasOutgoing = edges.some(e => e.source === id);

const onExecute = (mode: 'single' | 'sequence') => {
if (isFrameLimitExceeded) return;
window.dispatchEvent(new CustomEvent('execute-node', { detail: { nodeId: id, mode, isManual: true } }));
setShowRunOptions(false);
};

const onDownload = () => {
window.dispatchEvent(new CustomEvent('download-node', { detail: { nodeId: id } }));
};

const onPreview = () => {
if (!data.result) return;
window.dispatchEvent(new CustomEvent('open-preview', {
detail: {
type: 'video',
src: toDisplayUrl(data.result.path),
title: data.result.fileBaseName || data.label || `Node Video #${id.slice(-4)}`
}
}));
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

const removeReference = (e: React.MouseEvent, edgeId: string) => {
e.stopPropagation();
setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
};

const togglePause = (e: React.MouseEvent) => {
e.stopPropagation();
const nextPaused = !data.isPaused;
setNodes((nds) =>
nds.map((node) => node.id === id ? { ...node, data: { ...node.data, isPaused: nextPaused } } : node)
);

if (!nextPaused && data.isWaiting) {
onExecute('sequence');
}
};

const calculateTotalCredits = () => {
if (data.model !== 'Omni Flash') return 0;
const base = data.resolution === '720p' ? 15 : (data.duration <= 4 ? 15 : (data.duration <= 6 ? 20 : (data.duration <= 8 ? 25 : 30)));
const extra = data.resolution === '2k' ? 5 : (data.resolution === '4k' ? 10 : 0);
return base + extra;
};

useEffect(() => {
const handleClickOutside = (e: MouseEvent) => {
if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) setShowRunOptions(false);
};
document.addEventListener('mousedown', handleClickOutside);
return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);

return (
<div className={`node-container !bg-[#0d1424] !w-[210px] !p-0 overflow-hidden group/node ${isFrameLimitExceeded ? '!border-red-500' : '!border-[#f5a623]/20'}`}>
<div className="p-2.5 border-b border-white/5 flex items-center justify-between bg-[#0b1019]/50">
<div className="flex items-center gap-2 overflow-hidden">
<span className="material-symbols-outlined text-[#f5a623] text-[16px] shrink-0">movie</span>
<span className="text-[11px] font-black uppercase tracking-tight text-white truncate">
{data.label || 'Video AI'}
</span>
</div>

<div className="flex items-center gap-0.5 shrink-0">
<button
onClick={onDuplicate}
className="p-1 hover:bg-white/10 rounded-lg text-[#94a3b8] hover:text-[#f5a623] transition-all flex items-center justify-center"
title="Nhân bản node"
>
<span className="material-symbols-outlined text-[14px]">content_copy</span>
</button>
<button
onClick={onOpenSettings}
className="p-1 hover:bg-white/10 rounded-lg text-[#94a3b8] hover:text-white transition-all flex items-center justify-center"
title="Cài đặt node"
>
<span className="material-symbols-outlined text-[14px]">tune</span>
</button>

{(data.sequenceIndex && data.sequenceIndex !== 1) && (
<button
onClick={togglePause}
className={`p-1 rounded-lg transition-all flex items-center justify-center ${data.isPaused ? 'bg-[#f5a623] text-white' : 'text-[#94a3b8] hover:text-white hover:bg-white/10'}`}
>
<span className="material-symbols-outlined text-[14px]">{data.isPaused ? 'pause_circle' : 'play_circle'}</span>
</button>
)}
<button
onClick={onDeleteNode}
className="p-1 hover:bg-red-500/20 rounded-lg text-[#94a3b8] hover:text-red-400 transition-all flex items-center justify-center"
title="Xoá node"
>
<span className="material-symbols-outlined text-[14px]">delete</span>
</button>
</div>
</div>

<div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col gap-4 -translate-x-2 pointer-events-none z-50">
<div className="flex items-center gap-1.5">
<Handle type="target" position={Position.Left} id="media-in" className="!bg-[#F1641E] !w-2 !h-2 !static !translate-x-0 !border-2 !border-[#0d1424]" />
<span className="text-[7px] font-black text-white/30 lowercase tracking-[0.1em] -translate-y-[0.5px]">image</span>
</div>
<div className="flex items-center gap-1.5">
<Handle type="target" position={Position.Left} id="style-in" className="!bg-[#F1641E] !w-2 !h-2 !static !translate-x-0 !border-2 !border-[#0d1424]" />
<span className="text-[7px] font-black text-white/30 lowercase tracking-[0.1em] -translate-y-[0.5px]">style</span>
</div>
</div>

<div
className="w-full bg-black/60 flex items-center justify-center relative overflow-hidden group/media transition-all duration-300"
style={{ aspectRatio: data.aspectRatio === '9:16' ? '9/16' : '16/9' }}
>
{data.result ? (
<>
<video src={toDisplayUrl(data.result.path)} className="w-full h-full object-cover" autoPlay loop muted playsInline />
<button
onClick={(e) => { e.stopPropagation(); onPreview(); }}
className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 border border-[#F1641E]/30 flex items-center justify-center text-[#F1641E] opacity-60 group-hover/media:opacity-100 hover:bg-black/70 hover:scale-110 transition-all z-20 shadow-2xl"
>
<span className="material-symbols-outlined text-[24px]">play_arrow</span>
</button>
<button
onClick={clearResult}
className="absolute bottom-1.5 left-1.5 p-1.5 bg-black/70 hover:bg-red-600 text-white rounded-lg opacity-0 group-hover/media:opacity-100 transition-all border border-white/10 flex items-center justify-center shadow-2xl"
title="Xoá kết quả để tạo lại"
>
<span className="material-symbols-outlined text-[14px]">delete</span>
</button>
<button
onClick={(e) => { e.stopPropagation(); onDownload(); }}
className="absolute bottom-1.5 right-1.5 p-1.5 bg-black/70 hover:bg-black text-white rounded-lg opacity-0 group-hover/media:opacity-100 transition-all border border-white/10 flex items-center justify-center shadow-2xl"
>
<span className="material-symbols-outlined text-[14px]">download</span>
</button>
</>
) : (
<div className="flex flex-col items-center justify-center gap-2 opacity-10">
<span className="material-symbols-outlined text-4xl">movie</span>
<span className="text-[8px] font-black uppercase tracking-widest text-center">Chờ xử lý</span>
</div>
)}

{(data.isLoading || data.statusText === 'ĐANG CHỜ' || data.statusText === 'ĐÃ DỪNG' || data.statusText === 'ĐANG ĐỢI DATA') && (
<div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-10 px-4 text-center">
{data.statusText === 'Hoàn tất' ? (
<span className="material-symbols-outlined text-green-400 text-2xl animate-in zoom-in">check_circle</span>
) : (data.statusText === 'ĐANG CHỜ' || data.statusText === 'ĐANG ĐỢI DATA') ? (
<span className="material-symbols-outlined text-[#f5a623] text-2xl animate-pulse">pause_circle</span>
) : data.statusText === 'ĐÃ DỪNG' ? (
<span className="material-symbols-outlined text-red-400 text-2xl">block</span>
) : (
<span className="material-symbols-outlined text-[#f5a623] text-xl animate-spin">sync</span>
)}
<span className={`text-[9px] font-black uppercase tracking-[0.15em] ${data.statusText === 'Hoàn tất' ? 'text-green-400' : 'text-[#f5a623]'}`}>
{data.statusText || 'Đang tạo...'}
</span>
</div>
)}

<div className="absolute top-1.5 right-1.5">
<div className="bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded-full border border-white/10 flex items-center gap-1 shadow-xl">
<span className="text-[8px] font-black text-[#f5a623]">{calculateTotalCredits()}</span>
<span className="text-[6px] font-black text-white/40 uppercase">Credits</span>
</div>
</div>

{isFrameLimitExceeded && (
<div className="absolute bottom-0 left-0 w-full bg-red-600/90 backdrop-blur-md py-1.5 px-3 flex items-center gap-2 z-20">
<span className="material-symbols-outlined text-white text-[14px]">warning</span>
<span className="text-[8px] font-black text-white uppercase tracking-tight">Vượt quá 2 ảnh đầu vào</span>
</div>
)}
</div>

<div className="p-2.5 flex flex-col gap-2.5">
{incomingMedia.length > 0 && (
<div className="flex flex-wrap gap-1">
{incomingMedia.slice(0, 10).map((item: any, idx: number) => (
<div key={item.id} className="relative w-6 h-6 rounded-lg overflow-hidden border border-white/10 bg-black group/thumb" title={item.label}>
{item.path && (item.type === 'video' ? <video src={toDisplayUrl(item.path)} className="w-full h-full object-cover" muted /> : <img src={toDisplayUrl(item.path)} className="w-full h-full object-cover" alt="" />)}
<div className="absolute bottom-0 right-0 bg-[#F1641E] text-black text-[6px] font-black px-1 rounded-tl-sm">{idx + 1}</div>
<button
onClick={(e) => removeReference(e, item.edgeId)}
className="absolute inset-0 bg-red-600/80 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
title="Xoá tham chiếu"
>
<span className="material-symbols-outlined text-[12px] text-white">close</span>
</button>
</div>
))}
</div>
)}

<div className="relative" ref={optionsRef}>
<button
onClick={() => hasOutgoing ? setShowRunOptions(!showRunOptions) : onExecute('single')}
disabled={data.isLoading || isFrameLimitExceeded}
className="w-full bg-[#f5a623] hover:bg-[#c85a00] text-white py-2 rounded-xl text-[9.5px] font-black flex items-center justify-center gap-2 transition-all active:scale-95 uppercase disabled:opacity-20 disabled:grayscale tracking-[0.1em]"
>
<span className="material-symbols-outlined text-[16px]">play_arrow</span>
Xử lý Node
{hasOutgoing && <span className="material-symbols-outlined text-[14px] ml-auto">expand_more</span>}
</button>

{showRunOptions && (
<div className="absolute bottom-full left-0 w-full mb-1.5 bg-[#0d1424] border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-[100] animate-dropdown backdrop-blur-xl">
<button onClick={() => onExecute('single')} className="w-full px-4 py-2.5 text-left hover:bg-white/5 flex items-center gap-3 transition-colors">
<span className="material-symbols-outlined text-[#f5a623] text-[18px]">bolt</span>
<span className="text-[10px] font-black text-white uppercase tracking-tight">Chỉ Node này</span>
</button>
<div className="h-px bg-white/5 mx-1" />
<button onClick={() => onExecute('sequence')} className="w-full px-4 py-2.5 text-left hover:bg-white/5 flex items-center gap-3 transition-colors">
<span className="material-symbols-outlined text-[#f5a623] text-[18px]">double_arrow</span>
<span className="text-[10px] font-black text-white uppercase tracking-tight">Chạy đến hết</span>
</button>
</div>
)}
</div>
</div>

<div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center translate-x-2 pointer-events-none z-50">
<Handle type="source" position={Position.Right} id="media-out" className="!bg-[#F1641E] !w-2 !h-2 !static !translate-x-0 !border-2 !border-[#0d1424]" />
</div>
</div>
);
};

export default VideoGenNode;
