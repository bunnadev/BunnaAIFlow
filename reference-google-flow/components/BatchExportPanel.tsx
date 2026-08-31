import React, { useState } from 'react';
import { Node } from 'reactflow';
import { Flow } from 'flow-sdk';
import JSZip from 'jszip';
import { getNodeFileName } from '../App';

interface Props {
nodes: Node[];
globalPrefix?: string;
}

const BatchExportPanel: React.FC<Props> = ({ nodes, globalPrefix }) => {
const [isExporting, setIsExporting] = useState(false);
const [exportStatus, setExportStatus] = useState<'idle' | 'preparing' | 'done'>('idle');
const [isMinimized, setIsMinimized] = useState(false);

const getSortedResults = () => {
return [...nodes]
.filter(n => n.data.result && n.data.isFinalized)
.sort((a, b) => {
const rowDiff = a.position.y - b.position.y;
if (Math.abs(rowDiff) < 60) return a.position.x - b.position.x;
return rowDiff;
});
};

const sortedNodesWithResults = getSortedResults();
const selectedNodesWithResults = nodes.filter(n => n.selected && n.data.result);

const downloadNodes = async (targetNodes: Node[], label: string) => {
if (targetNodes.length === 0) return;
setIsExporting(true);
setExportStatus('preparing');
try {
const zip = new JSZip();
for (let i = 0; i < targetNodes.length; i++) {
const node = targetNodes[i];
const item = node.data.result;
const base64 = item.url.split(',')[1];
const fileName = getNodeFileName(node, i, globalPrefix);
zip.file(fileName, base64, { base64: true });
}
const content = await zip.generateAsync({ type: 'blob' });
const reader = new FileReader();
reader.onload = async () => {
try {
const base64 = (reader.result as string).split(',')[1];
await Flow.download({ base64, mimeType: 'application/zip', filename: `export_${label}_${Date.now()}.zip` });
setExportStatus('done');
setTimeout(() => setExportStatus('idle'), 3000);
} catch (downloadErr) { console.error(downloadErr); }
};
reader.readAsDataURL(content);
} catch (err) { console.error(err); } finally { setIsExporting(false); }
};

if (sortedNodesWithResults.length === 0) return null;

return (
<div className={`bg-[#0d1424]/90 backdrop-blur-xl border border-[#F1641E]/20 rounded-2xl shadow-2xl flex flex-col pointer-events-auto transition-all ${isMinimized ? 'w-36 h-10 p-2' : 'w-[220px] h-auto p-4'}`}>
<div className="flex justify-between items-center shrink-0">
<div className="flex items-center gap-1.5">
<div className="w-5 h-5 rounded-md bg-[#F1641E]/10 flex items-center justify-center">
<span className="material-symbols-outlined text-[14px] text-[#F1641E]">inventory_2</span>
</div>
{!isMinimized && <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">Asset List</span>}
</div>
<div className="flex items-center gap-2">
<div className="bg-[#F1641E] text-black text-[8px] font-black px-1.5 py-0.5 rounded-lg">{sortedNodesWithResults.length}</div>
<button onClick={() => setIsMinimized(!isMinimized)} className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-white/40"><span className="material-symbols-outlined text-[16px]">{isMinimized ? 'expand_less' : 'expand_more'}</span></button>
</div>
</div>

{!isMinimized && (
<>
<div className="flex flex-col gap-1.5 mt-4 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
{sortedNodesWithResults.map((node, i) => {
const fileName = getNodeFileName(node, i, globalPrefix);
const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
return (
<div key={node.id} className={`flex items-center gap-2 p-1.5 bg-white/[0.02] rounded-xl border ${node.selected ? 'border-[#F1641E]/60 bg-[#F1641E]/10' : 'border-white/5'}`}>
<div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center overflow-hidden border border-white/10 shrink-0">
{node.data.result.type === 'video' ? <span className="material-symbols-outlined text-[#f5a623] text-[16px]">movie</span> : <img src={node.data.result.url} className="w-full h-full object-cover" alt="" />}
</div>
<span className="text-[8.5px] text-white/90 font-black uppercase truncate tracking-widest flex-1">{baseName}</span>
</div>
);
})}
</div>
<div className="flex flex-col gap-1.5 mt-4 shrink-0">
<button
onClick={() => downloadNodes(sortedNodesWithResults, 'batch')}
disabled={isExporting}
className={`w-full h-9 rounded-xl text-[8.5px] font-black uppercase transition-all flex items-center justify-center gap-1.5 ${exportStatus === 'done' ? 'bg-[#F1641E] text-black' : 'bg-white/5 border border-white/10 text-white'}`}
>
{isExporting ? <><span className="material-symbols-outlined text-[16px] animate-spin">sync</span>NÉN...</> : <><span className="material-symbols-outlined text-[16px]">archive</span>XUẤT ZIP</>}
</button>
</div>
</>
)}
</div>
);
};

export default BatchExportPanel;
