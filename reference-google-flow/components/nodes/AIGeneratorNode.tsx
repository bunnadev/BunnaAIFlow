import React from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';

const AIGeneratorNode = ({ id, data }: any) => {
const { setNodes } = useReactFlow();

const updateData = (key: string, val: any) => {
setNodes((nds) =>
nds.map((node) =>
node.id === id ? { ...node, data: { ...node.data, [key]: val } } : node
)
);
};

return (
<div className="node-container !w-[260px]">
<Handle type="target" position={Position.Left} id="image-in" style={{ top: '30%' }} />
<Handle type="target" position={Position.Left} id="prompt-in" style={{ top: '70%' }} />

<div className="node-header">
<span className="material-symbols-outlined text-yellow-400 text-sm">auto_awesome</span>
<span className="node-title">Image Processor</span>
</div>

<div className="flex flex-col gap-4">
{/* Model Selection */}
<div className="flex flex-col gap-1.5">
<label className="text-[10px] text-white/40 uppercase font-bold tracking-wider">AI Model</label>
<select
value={data.model}
onChange={(e) => updateData('model', e.target.value)}
className="w-full bg-[#0e0e0e] border border-white/10 rounded-lg px-2 py-1.5 text-[11px] outline-none"
>
<option value="🍌 Nano Banana Pro">Banana Pro</option>
<option value="🍌 Nano Banana 2">Banana 2</option>
<option value="Imagen 4">Imagen 4</option>
</select>
</div>

{/* Sliders */}
<div className="flex flex-col gap-3">
<div className="flex flex-col gap-1">
<div className="flex justify-between text-[10px] text-white/60">
<span>Creativity</span>
<span>{data.creativity}</span>
</div>
<input
type="range" min="1" max="10"
value={data.creativity}
onChange={(e) => updateData('creativity', parseInt(e.target.value))}
/>
</div>

<div className="flex flex-col gap-1">
<div className="flex justify-between text-[10px] text-white/60">
<span>Resemblance</span>
<span>{data.resemblance}</span>
</div>
<input
type="range" min="1" max="10"
value={data.resemblance}
onChange={(e) => updateData('resemblance', parseInt(e.target.value))}
/>
</div>
</div>

{/* Ratio Toggles */}
<div className="flex flex-col gap-1.5">
<label className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Aspect Ratio</label>
<div className="flex gap-1">
{['1:1', '16:9', '9:16'].map(ratio => (
<button
key={ratio}
onClick={() => updateData('aspectRatio', ratio)}
className={`flex-1 py-1 text-[10px] rounded border transition-all ${data.aspectRatio === ratio ? 'bg-white/10 border-white/40' : 'border-white/5 hover:bg-white/5'}`}
>
{ratio}
</button>
))}
</div>
</div>

{data.isLoading && (
<div className="flex items-center gap-2 py-2 text-yellow-400 animate-pulse">
<span className="material-symbols-outlined text-[14px] animate-spin">refresh</span>
<span className="text-[10px] font-bold">PROCESSING...</span>
</div>
)}
</div>

<Handle type="source" position={Position.Right} id="gen-out" />
</div>
);
};

export default AIGeneratorNode;
