import React from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { saveAssetFromBytes, mimeTypeFromExtension, toDisplayUrl } from '../../lib/assets';
import type { MediaAsset } from '../../types';

// Tạm ẩn nút Vector hoá — kết quả chưa đủ ổn định với ảnh AI generate đa dạng,
// cần nghiên cứu thêm cấu hình vtracer trước khi bật lại (giữ nguyên phần code).
const VECTORIZE_ENABLED = false;

const MediaSourceNode = ({ id, data }: any) => {
const { setNodes, deleteElements } = useReactFlow();

const updateNodeMedia = (media: MediaAsset | null) => {
setNodes((nds) =>
nds.map((node) =>
node.id === id ? { ...node, data: { ...node.data, media } } : node
)
);
};

const selectFromDisk = async () => {
try {
const picked = await open({
multiple: false,
filters: [{ name: 'Ảnh/Video/Audio', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'webm', 'mov', 'mp3', 'wav', 'm4a', 'aac'] }],
});
if (!picked || Array.isArray(picked)) return;

const mimeType = mimeTypeFromExtension(picked);
const type: 'image' | 'video' | 'audio' = mimeType.startsWith('video') ? 'video' : mimeType.startsWith('audio') ? 'audio' : 'image';
const bytes = await readFile(picked);
const asset = await saveAssetFromBytes(bytes, mimeType);
const name = picked.split(/[/\\]/).pop() ?? 'Media';

updateNodeMedia({ ...asset, type, name });
} catch (e) {
console.error('[MediaSource] Lỗi khi chọn media:', e);
}
};

const clearMedia = (e: React.MouseEvent) => {
e.stopPropagation();
updateNodeMedia(null);
};

const onPreview = (e: React.MouseEvent) => {
e.stopPropagation();
if (!data.media) return;
window.dispatchEvent(new CustomEvent('open-preview', {
detail: {
type: data.media.type === 'video' ? 'video' : 'image',
src: toDisplayUrl(data.media.path),
title: data.media.name
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

const onVectorize = (e: React.MouseEvent) => {
e.stopPropagation();
window.dispatchEvent(new CustomEvent('vectorize-node', { detail: { nodeId: id } }));
};

return (
<div className="node-container !bg-[#0d1424] !border-[#F1641E]/20 !p-0 !w-[220px] !max-w-[220px] overflow-hidden group/node">
<div className="p-2.5 border-b border-white/5 flex items-center justify-between bg-[#0b1019]/50">
<div className="flex items-center gap-2 overflow-hidden">
<span className="material-symbols-outlined text-[#F1641E] text-sm shrink-0">perm_media</span>
<span className="text-[11px] font-black uppercase tracking-tight text-white truncate">
{data.label || 'Nguồn Media'}
</span>
</div>
<div className="flex items-center gap-0.5 shrink-0">
<button
onClick={onDuplicate}
className="p-1 hover:bg-white/10 rounded-lg text-[#94a3b8] hover:text-[#F1641E] transition-all"
title="Nhân bản node"
>
<span className="material-symbols-outlined text-[14px]">content_copy</span>
</button>
<button
onClick={onOpenSettings}
className="p-1 hover:bg-white/10 rounded-lg text-[#94a3b8] hover:text-white transition-all"
title="Cài đặt node"
>
<span className="material-symbols-outlined text-[14px]">tune</span>
</button>
<button
onClick={onDeleteNode}
className="p-1 hover:bg-red-500/20 rounded-lg text-[#94a3b8] hover:text-red-400 transition-all"
title="Xoá node"
>
<span className="material-symbols-outlined text-[14px]">delete</span>
</button>
</div>
</div>

<div className="p-2.5">
{data.media ? (
<div
onClick={onPreview}
className="relative group/img overflow-hidden rounded-xl border border-white/10 w-full min-h-[90px] bg-black flex items-center justify-center shadow-2xl cursor-pointer hover:border-[#F1641E]/40 transition-all"
>
{data.media.type === 'video' ? (
<video src={toDisplayUrl(data.media.path)} className="w-full h-auto max-h-[200px] object-contain" muted loop autoPlay playsInline />
) : data.media.type === 'audio' ? (
<div className="w-full py-6 flex flex-col items-center justify-center gap-2 text-white/40">
<span className="material-symbols-outlined text-3xl">graphic_eq</span>
<audio src={toDisplayUrl(data.media.path)} controls className="w-full h-7" onClick={(e) => e.stopPropagation()} />
</div>
) : (
<img src={toDisplayUrl(data.media.path)} className="w-full h-auto max-h-[200px] object-contain" alt="Preview" />
)}
<div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-all flex flex-col items-center justify-center gap-2 backdrop-blur-[2px]">
<div className="flex items-center gap-2">
<div className="w-8 h-8 rounded-full bg-black/60 border border-[#F1641E]/40 flex items-center justify-center text-[#F1641E]">
<span className="material-symbols-outlined text-[18px]">visibility</span>
</div>
{VECTORIZE_ENABLED && data.media.type === 'image' && (
<button
onClick={onVectorize}
className="w-8 h-8 rounded-full bg-black/60 border border-[#3b82f6]/40 flex items-center justify-center text-[#3b82f6] hover:bg-[#3b82f6] hover:text-white transition-all"
title="Vector hoá thành SVG"
>
<span className="material-symbols-outlined text-[18px]">data_object</span>
</button>
)}
<button
onClick={clearMedia}
className="w-8 h-8 rounded-full bg-black/60 border border-red-500/40 flex items-center justify-center text-red-400 hover:bg-red-500 hover:text-white transition-all"
title="Xoá media"
>
<span className="material-symbols-outlined text-[18px]">delete</span>
</button>
</div>
<span className="text-[7px] text-white font-black uppercase tracking-widest bg-black/60 px-2 py-1 rounded-md">Xem trước</span>
</div>
</div>
) : (
<button
onClick={selectFromDisk}
className="w-full h-[140px] bg-[#050a10] border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-3 transition-all hover:bg-white/[0.04] hover:border-[#F1641E]/30 group/btn"
>
<div className="w-10 h-10 rounded-full bg-white/[0.03] flex items-center justify-center group-hover/btn:bg-[#F1641E]/10 transition-all">
<span className="material-symbols-outlined text-white/10 text-2xl group-hover/btn:text-[#F1641E]/40">photo_library</span>
</div>
<span className="text-[9px] text-[#94a3b8] font-black uppercase tracking-widest">Chọn Media</span>
</button>
)}
</div>

<div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center translate-x-2 pointer-events-none">
<Handle type="source" position={Position.Right} id="media-out" className="!bg-[#F1641E] !w-2 !h-2 !static !translate-x-0" />
</div>
</div>
);
};

export default MediaSourceNode;
