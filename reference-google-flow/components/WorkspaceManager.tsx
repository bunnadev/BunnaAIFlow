import React, { useState, useRef, useEffect } from 'react';

interface Workspace {
id: string;
name: string;
}

interface FlowStatus {
message: string;
type: 'info' | 'error' | 'success' | 'warning';
canUndo?: boolean;
}

interface Props {
workspaces: Workspace[];
activeId: string;
saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
isGlobalPaused: boolean;
concurrency: number;
onChangeConcurrency: (val: number) => void;
onRunPipeline: () => void;
onStopPipeline: () => void;
isStopping: boolean;
filenamePrefix: string;
onChangePrefix: (val: string) => void;
flowStatus: FlowStatus | null;
onClearFlowStatus: () => void;
onTogglePause: () => void;
onSelect: (id: string) => void;
onAdd: () => void;
onDelete: (id: string) => void;
onRename: (id: string, name: string) => void;
onOpenLog: () => void;
onUndo?: () => void;
}

const WorkspaceManager: React.FC<Props> = ({
workspaces, activeId,
concurrency, onChangeConcurrency, onRunPipeline, onStopPipeline, isStopping,
filenamePrefix, onChangePrefix, flowStatus, onClearFlowStatus,
onSelect, onAdd, onDelete, onRename, onOpenLog, onUndo
}) => {
const [isDropdownOpen, setIsDropdownOpen] = useState(false);
const [renamingId, setRenamingId] = useState<string | null>(null);
const [renameValue, setRenameValue] = useState("");
const dropdownRef = useRef<HTMLDivElement>(null);

const activeWorkspace = workspaces.find(w => w.id === activeId) || workspaces[0];

useEffect(() => {
const handleClickOutside = (e: MouseEvent) => {
if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsDropdownOpen(false);
};
document.addEventListener('mousedown', handleClickOutside);
return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);

const handleRenameSubmit = (id: string) => {
if (renameValue.trim()) {
onRename(id, renameValue);
}
setRenamingId(null);
};

return (
<div className="flex items-center gap-0 h-[48px] bg-[#0b1019] border-b border-[#F1641E]/20 z-50 px-3 shrink-0 relative">
<div className="flex items-center gap-2 h-9 px-2.5 rounded-xl border border-[#F1641E]/40 bg-[#07101f]/90 shadow-sm mr-4 shrink-0">
<div className="w-7 h-7 rounded-full border border-[#F1641E]/40 bg-[#F1641E]/10 flex items-center justify-center overflow-hidden">
<span className="material-symbols-outlined text-[#F1641E] text-lg">settings_input_component</span>
</div>
<div className="flex flex-col items-start justify-center">
<span className="text-[10px] font-black text-white uppercase tracking-wider leading-none">BUNNA AI FLOW</span>
<span className="text-[7px] font-black text-white/20 leading-none tracking-tighter mt-0.5">N8N ENGINE</span>
</div>
</div>

<div className="relative shrink-0 w-[180px]" ref={dropdownRef}>
<button
onClick={() => setIsDropdownOpen(!isDropdownOpen)}
className="w-full flex items-center justify-between h-8.5 px-3 bg-[#0d1424] border border-[#F1641E]/30 rounded-lg text-white shadow-sm hover:border-[#F1641E]/60 transition-all group"
>
<div className="flex items-center gap-1.5 overflow-hidden">
<span className="material-symbols-outlined text-[#F1641E] text-[16px]">account_tree</span>
<span className="text-[9px] font-black tracking-tight uppercase truncate">{activeWorkspace.name}</span>
</div>
<span className={`material-symbols-outlined text-[16px] text-white/20 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>expand_more</span>
</button>

{isDropdownOpen && (
<div className="absolute top-[calc(100%+6px)] left-0 w-[220px] bg-[#0d1424] border border-[#F1641E]/20 rounded-xl shadow-2xl py-1.5 overflow-hidden animate-dropdown-fast backdrop-blur-xl z-[100]">
<div className="max-h-52 overflow-y-auto custom-scrollbar">
{workspaces.map((ws) => (
<div
key={ws.id}
onClick={() => { if (!renamingId) { onSelect(ws.id); setIsDropdownOpen(false); } }}
className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-all group/item ${activeId === ws.id ? 'bg-[#F1641E]/10 text-[#F1641E] border-l-2 border-[#F1641E]' : 'text-[#94a3b8] hover:bg-white/5 hover:text-white'}`}
>
{renamingId === ws.id ? (
<input
autoFocus
className="bg-black/40 border border-[#F1641E]/30 rounded px-1.5 py-0.5 text-[9px] w-full text-white outline-none"
value={renameValue}
onChange={(e) => setRenameValue(e.target.value)}
onBlur={() => handleRenameSubmit(ws.id)}
onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit(ws.id)}
onClick={(e) => e.stopPropagation()}
/>
) : (
<span className="text-[9px] font-black tracking-widest uppercase truncate flex-1 pr-2">{ws.name}</span>
)}

<div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
<button onClick={(e) => { e.stopPropagation(); setRenamingId(ws.id); setRenameValue(ws.name); }} className="p-0.5 hover:bg-white/10 rounded"><span className="material-symbols-outlined text-[12px]">edit</span></button>
<button onClick={(e) => { e.stopPropagation(); onDelete(ws.id); }} className="p-0.5 hover:bg-red-500/20 text-red-400 rounded"><span className="material-symbols-outlined text-[12px]">delete</span></button>
</div>
</div>
))}
</div>
<div className="h-[1px] bg-white/5 my-1" />
<div className="px-1.5 py-1">
<button
onClick={() => { onAdd(); setIsDropdownOpen(false); }}
className="w-full flex items-center gap-2 px-2 py-1.5 text-[9px] font-black text-[#F1641E] hover:bg-[#F1641E]/10 rounded-lg transition-all uppercase tracking-widest"
>
<span className="material-symbols-outlined text-[16px]">add_circle</span>
Mới
</button>
</div>
</div>
)}
</div>

<div className="flex-1" />

{flowStatus && (
<div className={`mx-3 px-3 py-1.5 rounded-lg border flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-300 ${
flowStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' :
flowStatus.type === 'error' ? 'bg-red-500/10 border-red-500 text-red-400' : 'bg-[#f5a623]/10 border-[#f5a623] text-[#f5a623]'
}`}>
<span className="material-symbols-outlined text-[16px]">
{flowStatus.type === 'success' ? 'check_circle' : flowStatus.type === 'error' ? 'error' : 'warning'}
</span>
<span className="text-[9px] font-black uppercase tracking-widest">{flowStatus.message}</span>
<button onClick={onClearFlowStatus} className="ml-1 hover:opacity-50"><span className="material-symbols-outlined text-[12px]">close</span></button>
</div>
)}

<div className="flex items-center gap-2 h-full border-l border-white/5 pl-3">
<button onClick={onOpenLog} className="flex items-center gap-1.5 px-2.5 h-7.5 rounded-xl bg-white/[0.03] border border-white/10 text-[#F1641E] hover:bg-[#F1641E]/10 transition-all font-black text-[8px] uppercase tracking-widest">
<span className="material-symbols-outlined text-[16px]">assignment</span>
LOGS
</button>

<div className="flex items-center gap-1.5 px-2 bg-[#050a10] border border-white/10 rounded-xl h-7.5 group">
<span className="text-[8px] font-black text-[#94a3b8]/40 uppercase tracking-widest">PREFIX</span>
<input type="text" value={filenamePrefix} onChange={(e) => onChangePrefix(e.target.value)} className="bg-transparent border-none outline-none text-[9px] font-black text-white w-16 uppercase" />
</div>

<button onClick={onRunPipeline} className="flex items-center gap-1.5 px-3 h-7.5 rounded-xl bg-[#F1641E] text-black hover:bg-[#F1641E]/80 transition-all shadow-md font-black text-[8px] uppercase tracking-widest">
<span className="material-symbols-outlined text-[16px]">bolt</span>
START
</button>

<button onClick={onStopPipeline} disabled={isStopping} className="flex items-center gap-1.5 px-2.5 h-7.5 rounded-xl bg-white/[0.03] border border-white/10 text-red-400 hover:bg-red-500 hover:text-white transition-all disabled:opacity-20 font-black text-[8px] uppercase tracking-widest">
<span className="material-symbols-outlined text-[16px]">stop</span>
STOP
</button>
</div>
</div>
);
};

export default WorkspaceManager;
