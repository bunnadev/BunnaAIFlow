import React, { useState, useRef, useEffect } from 'react';

interface Props {
before: string;
after: string;
}

const ImageComparison: React.FC<Props> = ({ before, after }) => {
const [sliderPos, setSliderPos] = useState(50);
const containerRef = useRef<HTMLDivElement>(null);
const isDragging = useRef(false);

const handleMove = (clientX: number) => {
if (!containerRef.current) return;
const rect = containerRef.current.getBoundingClientRect();
const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
setSliderPos((x / rect.width) * 100);
};

const onMouseDown = () => { isDragging.current = true; };
const onMouseUp = () => { isDragging.current = false; };
const onMouseMove = (e: React.MouseEvent) => {
if (isDragging.current) handleMove(e.clientX);
};
const onTouchMove = (e: React.TouchEvent) => {
handleMove(e.touches[0].clientX);
};

useEffect(() => {
window.addEventListener('mouseup', onMouseUp);
return () => window.removeEventListener('mouseup', onMouseUp);
}, []);

return (
<div
ref={containerRef}
className="relative w-full h-full max-w-[90vw] max-h-[80vh] flex items-center justify-center select-none cursor-col-resize overflow-hidden rounded-lg border border-white/10 shadow-2xl"
onMouseDown={onMouseDown}
onMouseMove={onMouseMove}
onTouchMove={onTouchMove}
>
{/* Ảnh sau (Kết quả) - Nằm dưới */}
<img
src={after}
alt="After"
className="w-full h-full object-contain pointer-events-none"
/>

{/* Ảnh trước (Gốc) - Nằm trên với clipping */}
<div
className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden flex items-center justify-center"
style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
>
<img
src={before}
alt="Before"
className="w-full h-full object-contain"
/>
</div>

{/* Thanh trượt phân cách */}
<div
className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] flex items-center justify-center"
style={{ left: `${sliderPos}%` }}
>
<div className="w-8 h-8 rounded-full bg-white border border-black/20 flex items-center justify-center shadow-lg -translate-x-1/2 cursor-grab active:cursor-grabbing">
<span className="material-symbols-outlined text-black text-[18px]">unfold_more</span>
</div>

{/* Nhãn */}
<div className="absolute top-4 left-4 bg-black/50 backdrop-blur-md px-2 py-1 rounded text-[10px] text-white/70 pointer-events-none">TRƯỚC</div>
<div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md px-2 py-1 rounded text-[10px] text-white/70 pointer-events-none">SAU</div>
</div>
</div>
);
};

export default ImageComparison;
