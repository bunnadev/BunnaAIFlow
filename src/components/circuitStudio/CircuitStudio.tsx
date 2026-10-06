import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ask } from '@tauri-apps/plugin-dialog';
import StudioCanvas, { type CanvasApi, type Selection } from './StudioCanvas';
import FloatingPanel from './FloatingPanel';
import PartLibraryPanel from './PartLibraryPanel';
import InspectorPanel from './InspectorPanel';
import WarningsBar from './WarningsBar';
import ProjectPicker from './ProjectPicker';
import { initialStudioState, studioReducer } from '../../lib/circuit/studioState';
import { duplicateProject, emptyLayout, newProject, type CircuitProject, type ProjectMeta } from '../../lib/circuit/projectModel';
import { deleteProject, listProjects, loadProject, saveProject } from '../../lib/circuit/circuitStore';
import { partBox, partPreviewSvg, validateLayout } from '../../lib/circuit/render';
import { routeWorld } from '../../lib/circuit/world';
import { addPart, deleteParts, duplicateParts, resetAllWires, rotateParts, deleteWire } from '../../lib/circuit/ops';
import { alignParts, distributeParts, type AlignMode } from '../../lib/circuit/arrange';
import { BUILTIN_LIBRARY, type LibraryItem } from '../../lib/circuit/libraryCatalog';
import type { CircuitLayout } from '../../lib/circuit/types';

interface Props { onClose(): void; geminiApiKey?: string }

const btn = 'flex h-8 items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 text-xs text-white/80 hover:bg-white/10 disabled:opacity-30';
const icon = (name: string) => <span className="material-symbols-outlined text-[18px]">{name}</span>;
const ALIGN: [AlignMode, string, string][] = [
  ['left', 'align_horizontal_left', 'Căn trái'], ['hcenter', 'align_horizontal_center', 'Căn giữa (cùng cột)'], ['right', 'align_horizontal_right', 'Căn phải'],
  ['top', 'align_vertical_top', 'Căn trên'], ['vcenter', 'align_vertical_center', 'Căn giữa (cùng hàng)'], ['bottom', 'align_vertical_bottom', 'Căn dưới'],
];

export default function CircuitStudio({ onClose }: Props) {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [project, setProject] = useState<CircuitProject | null>(null);
  const [state, dispatch] = useReducer(studioReducer, initialStudioState(emptyLayout()));
  const [selection, setSelection] = useState<Selection>({ parts: [], wire: null });
  const [partsVersion] = useState(0);
  const [showLibrary, setShowLibrary] = useState(true);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const [placing, setPlacing] = useState<{ item: LibraryItem; x: number; y: number } | null>(null);
  const apiRef = useRef<CanvasApi | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<CircuitProject | null>(null);
  projectRef.current = project;
  const layoutRef = useRef<CircuitLayout>(state.layout);
  layoutRef.current = state.layout;

  const layout = state.layout;
  const routed = useMemo(() => routeWorld(layout), [layout, partsVersion]);
  const issues = useMemo(() => { const v = validateLayout(layout, undefined, routed, { frame: false }); return [...v.errors, ...v.warnings]; }, [layout, routed]);
  const library = useMemo<LibraryItem[]>(() => BUILTIN_LIBRARY, [partsVersion]);

  const flash = useCallback((msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast((t) => (t?.msg === msg ? null : t)), 4000);
  }, []);
  const commit = useCallback((l: CircuitLayout) => dispatch({ type: 'commit', layout: l }), []);

  const refreshList = useCallback(async () => {
    const { projects: list, errors } = await listProjects();
    setProjects(list);
    if (errors.length) flash(`Bỏ qua file mạch hỏng: ${errors.join(', ')}`, true);
    return list;
  }, [flash]);

  /** Ghi ngay bản đang mở (khi đổi mạch / đóng màn hình). */
  const flush = useCallback(async () => {
    const p = projectRef.current;
    const cur = layoutRef.current;
    if (!p || p.layout === cur) return;
    const next = { ...p, layout: cur, updatedAt: new Date().toISOString() };
    await saveProject(next);
    projectRef.current = next;
    setProject(next);
  }, []);

  /** Ghi bản đang mở; lỗi thì báo và trả false để không đổi mạch / không đóng. */
  const safeFlush = useCallback(async () => {
    try { await flush(); return true; } catch (e) { flash(`Lỗi lưu: ${(e as Error).message ?? e}`, true); return false; }
  }, [flush, flash]);

  const openProject = useCallback(async (id: string) => {
    if (!(await safeFlush())) return;
    try {
      const p = await loadProject(id);
      setProject(p);
      dispatch({ type: 'load', layout: p.layout });
      setSelection({ parts: [], wire: null });
      setTimeout(() => apiRef.current?.fit(), 0);
    } catch (e) {
      flash(`Không mở được mạch: ${(e as Error).message}`, true);
    }
  }, [safeFlush, flash]);

  const createProject = useCallback(async () => {
    if (!(await safeFlush())) return;
    const p = newProject(`Mạch ${new Date().toLocaleDateString('vi-VN')}`);
    await saveProject(p);
    setProject(p);
    dispatch({ type: 'load', layout: p.layout });
    setSelection({ parts: [], wire: null });
    setTimeout(() => apiRef.current?.fit(), 0);
    await refreshList();
  }, [safeFlush, refreshList]);

  useEffect(() => {
    (async () => {
      const list = await refreshList();
      if (list[0]) await openProject(list[0].id);
      else await createProject();
    })().catch((e) => flash(String(e), true));
  }, []);

  // Tự lưu sau ~1 giây kể từ lần thay đổi cuối
  useEffect(() => {
    if (!project || project.layout === layout) return;
    const t = setTimeout(() => {
      const next = { ...project, layout, updatedAt: new Date().toISOString() };
      saveProject(next).then(() => { setProject(next); refreshList(); }).catch((e) => flash(`Lỗi lưu: ${e}`, true));
    }, 1000);
    return () => clearTimeout(t);
  }, [layout, project]);

  const close = async () => { if (!(await safeFlush())) return; onClose(); };

  // ─── Kéo linh kiện từ thư viện vào bàn vẽ ───
  useEffect(() => {
    if (!placing) return;
    const move = (e: PointerEvent) => setPlacing((p) => p && { ...p, x: e.clientX, y: e.clientY });
    const up = (e: PointerEvent) => {
      const item = placing.item;
      setPlacing(null);
      // Thả lên bảng nổi (thư viện, cột chỉnh sửa…) thì không đặt linh kiện
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (!target || !canvasWrapRef.current?.contains(target)) return;
      const pt = apiRef.current?.clientToLayout(e.clientX, e.clientY);
      if (!pt) return;
      const res = addPart(layout, item.type, pt.x, pt.y, item.idBase);
      commit(res.layout);
      setSelection({ parts: [res.id], wire: null });
    };
    const cancel = () => setPlacing(null);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    window.addEventListener('pointercancel', cancel, { once: true });
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); };
  }, [placing?.item, layout]);

  // ─── Phím tắt (bắt ở pha capture để canvas node phía sau không nhận phím Delete…) ───
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
      if (typing) return;
      const cmd = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      const handled = (cmd && (k === 'z' || (k === 'd' && selection.parts.length > 0))) || e.key === 'Delete' || e.key === 'Backspace'
        || (k === 'r' && !cmd && selection.parts.length > 0) || e.key === '0' || e.key === 'Escape';
      if (!handled) return;
      e.stopPropagation();
      if (cmd && e.key.toLowerCase() === 'z') { e.preventDefault(); dispatch({ type: e.shiftKey ? 'redo' : 'undo' }); return; }
      if (cmd && e.key.toLowerCase() === 'd' && selection.parts.length) {
        e.preventDefault();
        const r = duplicateParts(layout, selection.parts);
        commit(r.layout);
        setSelection({ parts: r.newIds, wire: null });
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selection.wire !== null) { commit(deleteWire(layout, selection.wire)); setSelection({ parts: [], wire: null }); }
        else if (selection.parts.length) {
          const r = deleteParts(layout, selection.parts);
          commit(r.layout);
          setSelection({ parts: [], wire: null });
          if (r.removedWires) flash(`Đã xoá kèm ${r.removedWires} dây nối vào.`);
        }
        return;
      }
      if (e.key.toLowerCase() === 'r' && !cmd && selection.parts.length) { commit(rotateParts(layout, selection.parts, e.shiftKey ? -1 : 1)); return; }
      if (e.key === '0') { apiRef.current?.fit(); return; }
      if (e.key === 'Escape') setSelection({ parts: [], wire: null });
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [layout, selection, commit, flash]);

  /** Bấm 1 cảnh báo → chọn và đưa chỗ lỗi ra giữa màn hình. */
  const pickWarning = (msg: string) => {
    const m = msg.match(/^Dây (\d+)/);
    if (m) {
      const i = Number(m[1]) - 1;
      const pts = routed[i]?.points;
      setSelection({ parts: [], wire: i });
      if (pts) apiRef.current?.focusBox({ x1: Math.min(...pts.map((p) => p.x)), y1: Math.min(...pts.map((p) => p.y)), x2: Math.max(...pts.map((p) => p.x)), y2: Math.max(...pts.map((p) => p.y)) });
      return;
    }
    const ids = layout.parts.map((p) => p.id).filter((id) => new RegExp(`(^|[\\s,(])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s.,)]|$)`).test(msg));
    setSelection({ parts: ids, wire: null });
    const boxes = layout.parts.filter((p) => ids.includes(p.id)).map((p) => partBox(p, true)).filter((b): b is NonNullable<typeof b> => !!b);
    if (boxes.length) apiRef.current?.focusBox({ x1: Math.min(...boxes.map((b) => b.x1)), y1: Math.min(...boxes.map((b) => b.y1)), x2: Math.max(...boxes.map((b) => b.x2)), y2: Math.max(...boxes.map((b) => b.y2)) });
  };

  const selParts = selection.parts.length;
  const hasSelection = selParts > 0 || selection.wire !== null;

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#141414] text-white">
      <div ref={canvasWrapRef} className="absolute inset-0">
        <StudioCanvas
          layout={layout}
          routed={routed}
          selection={selection}
          onSelect={setSelection}
          onCommit={commit}
          onApi={(api) => { apiRef.current = api; }}
        />
      </div>

      {/* Thanh công cụ nổi */}
      <div className="absolute left-3 right-3 top-3 z-30 flex h-12 items-center gap-2 rounded-xl border border-white/10 bg-[#1b1b1b]/90 px-3 shadow-2xl backdrop-blur">
        <ProjectPicker
          projects={projects}
          current={project}
          onOpen={openProject}
          onNew={createProject}
          onRename={async (name) => { if (!project) return; const next = { ...project, name, layout, updatedAt: new Date().toISOString() }; await saveProject(next); setProject(next); refreshList(); }}
          onDuplicate={async () => { if (!project) return; if (!(await safeFlush())) return; const d = duplicateProject({ ...project, layout }); await saveProject(d); await refreshList(); await openProject(d.id); }}
          onDelete={async () => {
            if (!project || !(await ask(`Xoá mạch "${project.name}"? Không khôi phục được.`, { title: 'Xoá mạch', kind: 'warning' }))) return;
            await deleteProject(project.id);
            setProject(null);
            const list = await refreshList();
            if (list[0]) await openProject(list[0].id); else await createProject();
          }}
        />
        <div className="mx-1 h-6 w-px bg-white/10" />
        <button className={btn} title="Thư viện linh kiện" onClick={() => setShowLibrary(!showLibrary)}>{icon('widgets')} Linh kiện</button>
        <button className={btn} title="Hoàn tác (Cmd+Z)" disabled={!state.past.length} onClick={() => dispatch({ type: 'undo' })}>{icon('undo')}</button>
        <button className={btn} title="Làm lại (Cmd+Shift+Z)" disabled={!state.future.length} onClick={() => dispatch({ type: 'redo' })}>{icon('redo')}</button>
        <button className={btn} title="Vừa màn hình (phím 0)" onClick={() => apiRef.current?.fit()}>{icon('fit_screen')}</button>
        <button className={btn} title="Tự đi lại tất cả dây (bỏ mọi chỉnh tay)" onClick={() => commit(resetAllWires(layout))}>{icon('route')}</button>
        {selParts >= 2 && (
          <>
            <div className="mx-1 h-6 w-px bg-white/10" />
            {ALIGN.map(([mode, ic, title]) => <button key={mode} className={btn} title={title} onClick={() => commit(alignParts(layout, selection.parts, mode))}>{icon(ic)}</button>)}
            <button className={btn} title="Chia đều ngang" disabled={selParts < 3} onClick={() => commit(distributeParts(layout, selection.parts, 'x'))}>{icon('horizontal_distribute')}</button>
            <button className={btn} title="Chia đều dọc" disabled={selParts < 3} onClick={() => commit(distributeParts(layout, selection.parts, 'y'))}>{icon('vertical_distribute')}</button>
          </>
        )}
        <div className="flex-1" />
        {toast && <span className={`text-xs ${toast.error ? 'text-red-400' : 'text-emerald-400'}`}>{toast.msg}</span>}
        <button className={btn} title="Đóng" onClick={close}>{icon('close')}</button>
      </div>

      {showLibrary && (
        <FloatingPanel id="library" title="Linh kiện" defaultPos={{ x: 12, y: 72 }} width={230} onClose={() => setShowLibrary(false)}>
          <PartLibraryPanel items={library} version={partsVersion} onStartPlace={(item, e) => setPlacing({ item, x: e.clientX, y: e.clientY })} />
        </FloatingPanel>
      )}

      {hasSelection && (
        <FloatingPanel id="inspector" title={selection.wire !== null ? `Dây ${selection.wire + 1}` : selParts === 1 ? `Linh kiện ${selection.parts[0]}` : `${selParts} linh kiện`}
          defaultPos={{ x: window.innerWidth - 264, y: 72 }} width={252}>
          <InspectorPanel key={selection.wire !== null ? `w${selection.wire}` : selection.parts.join(',')} layout={layout} selection={selection} onCommit={commit} onSelect={setSelection} onError={(m) => flash(m, true)} />
        </FloatingPanel>
      )}

      <WarningsBar messages={issues} onPick={pickWarning} />

      {placing && (
        <img alt="" className="pointer-events-none fixed z-[110] h-16 w-16 -translate-x-1/2 -translate-y-1/2 opacity-80"
          style={{ left: placing.x, top: placing.y }}
          src={'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(partPreviewSvg(placing.item.type, 64))} />
      )}
    </div>
  );
}
