import React, { useState } from 'react';
import {
EdgeProps,
getBezierPath,
EdgeLabelRenderer,
useReactFlow,
} from 'reactflow';

export default function DeleteEdge({
id,
sourceX,
sourceY,
targetX,
targetY,
sourcePosition,
targetPosition,
style = {},
markerEnd,
}: EdgeProps) {
const { setEdges } = useReactFlow();
const [isHovered, setIsHovered] = useState(false);
const [edgePath, labelX, labelY] = getBezierPath({
sourceX,
sourceY,
sourcePosition,
targetX,
targetY,
targetPosition,
});

const onEdgeClick = (evt: React.MouseEvent) => {
evt.stopPropagation();
setEdges((edges) => edges.filter((edge) => edge.id !== id));
};

return (
<>
{/* Path thực tế */}
<path
id={id}
style={style}
className="react-flow__edge-path"
d={edgePath}
markerEnd={markerEnd}
onMouseEnter={() => setIsHovered(true)}
onMouseLeave={() => setIsHovered(false)}
/>

{/* "Hit Area" rộng hơn để dễ hover */}
<path
d={edgePath}
fill="none"
stroke="transparent"
strokeWidth={20}
className="react-flow__edge-interaction"
onMouseEnter={() => setIsHovered(true)}
onMouseLeave={() => setIsHovered(false)}
/>

<EdgeLabelRenderer>
<div
style={{
position: 'absolute',
transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
fontSize: 12,
pointerEvents: 'all',
zIndex: 1000,
}}
className="nodrag nopan"
>
<button
className={`w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center transition-all shadow-2xl border border-white/20 active:scale-90 ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'}`}
onClick={onEdgeClick}
onMouseEnter={() => setIsHovered(true)}
onMouseLeave={() => setIsHovered(false)}
title="Xoá liên kết"
>
<span className="material-symbols-outlined text-[18px]">delete</span>
</button>
</div>
</EdgeLabelRenderer>
</>
);
}
