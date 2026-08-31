import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../App';

interface Props {
logs: LogEntry[];
onClear: () => void;
onClose: () => void;
}

const ExecutionLogPanel: React.FC<Props> = ({ logs, onClear, onClose }) => {
const scrollRef = useRef<HTMLDivElement>(null);
useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [logs]);

const getStatusColor = (status: LogEntry['status']) => {
switch (status) {
case 'success': return 'text-[#F1641E]';
case 'error': return 'text-red-400';
case 'running': return 'text-yellow-400';
default: return 'text-white/40';
}
};

const getStatusIcon = (status: LogEntry['status']) => {
switch (status) {
case 'success': return 'check_circle';
case 'error': return 'error';
case 'running': return 'sync';
default: return 'pending';
}
};

return (
<div className="absolute top-0 right-0 h-full w-[260px] bg-[#0b1019] border-l border-[#F1641E]/20 z-[90] flex flex-col shadow-2xl animate-slide-panel">
<div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
<div className="flex items-center gap-2">
<div className="w-7 h-7 rounded-lg bg-[#F1641E]/10 border border-[#F1641E]/30 flex items-center justify-center">
<span className="material-symbols-outlined text-[#F1641E] text-[18px]">assignment</span>
</div>
<h3 className="text-[10px] font-black text-white uppercase tracking-widest">Nhật ký</h3>
</div>
<div className="flex items-center gap-1.5">
<button onClick={onClear} className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[9px] text-[#94a3b8] font-bold uppercase">Xoá</button>
<button onClick={onClose} className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-[#94a3b8] flex items-center justify-center border border-white/5"><span className="material-symbols-outlined text-[14px]">close</span></button>
</div>
</div>

<div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-1.5 bg-[#070b14]">
{logs.length === 0 ? (
<div className="flex-1 flex flex-col items-center justify-center opacity-10 gap-2">
<span className="material-symbols-outlined text-4xl">list_alt</span>
<span className="text-[8px] font-black uppercase tracking-widest">Trống</span>
</div>
) : (
logs.map((log) => (
<div key={log.id} className="p-2 bg-white/[0.02] border border-white/5 rounded-lg flex flex-col gap-1">
<div className="flex items-center justify-between">
<div className="flex items-center gap-1.5 overflow-hidden">
<span className={`material-symbols-outlined text-[12px] ${getStatusColor(log.status)} ${log.status === 'running' ? 'animate-spin' : ''}`}>{getStatusIcon(log.status)}</span>
<span className="text-[8.5px] font-black text-white/80 uppercase truncate">{log.nodeName}</span>
</div>
<span className="text-[7px] text-white/20 font-mono">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
</div>
<p className="text-[8px] text-[#94a3b8] leading-tight pl-4">{log.message}</p>
</div>
))
)}
</div>
</div>
);
};

export default ExecutionLogPanel;
