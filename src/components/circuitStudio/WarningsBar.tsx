interface Props { messages: string[]; onPick(msg: string): void }

/** Cảnh báo bố cục, nổi ở giữa đáy màn hình. */
export default function WarningsBar({ messages, onPick }: Props) {
  if (!messages.length) return null;
  return (
    <div className="absolute bottom-3 left-1/2 z-20 flex max-w-[60vw] -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-full border border-amber-500/30 bg-[#2a2010]/90 px-4 py-1.5 text-xs text-amber-200 shadow-xl backdrop-blur">
      <span className="shrink-0 font-semibold">⚠ {messages.length} cảnh báo:</span>
      {messages.map((m, i) => (
        <button key={i} onClick={() => onPick(m)} className="shrink-0 rounded px-1.5 py-0.5 underline decoration-dotted hover:bg-amber-500/20">{m}</button>
      ))}
    </div>
  );
}
