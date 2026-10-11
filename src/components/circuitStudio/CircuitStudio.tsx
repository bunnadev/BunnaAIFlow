import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ask } from '@tauri-apps/plugin-dialog';
import StudioCanvas, { type CanvasApi, type Selection } from './StudioCanvas';
import FloatingPanel from './FloatingPanel';
import PartLibraryPanel from './PartLibraryPanel';
import ExportDialog from './ExportDialog';
import AddPartWizard from './AddPartWizard';
import { deleteCustomPart, listCustomParts, loadCustomParts, projectsUsingPart, type CustomPartEntry } from '../../lib/circuit/customPartsStore';
import InspectorPanel from './InspectorPanel';
import WarningsBar from './WarningsBar';
import ProjectPicker from './ProjectPicker';
import { initialStudioState, pruneSelection, studioReducer } from '../../lib/circuit/studioState';
import { duplicateProject, emptyLayout, newProject, type CircuitProject, type ProjectMeta } from '../../lib/circuit/projectModel';
import { deleteProject, listProjects, loadProject, saveProject } from '../../lib/circuit/circuitStore';
import { partBox, partPreviewSvg, validateLayout } from '../../lib/circuit/render';
import { pinAutoWires, routeWorld, routingSignature } from '../../lib/circuit/world';
import { addPart, deleteParts, duplicateParts, resetAllWires, rotateParts, deleteWire, movePartsBy } from '../../lib/circuit/ops';
import { contactSnap, syncContacts } from '../../lib/circuit/contacts';
import { alignParts, distributeParts, type AlignMode } from '../../lib/circuit/arrange';
import { BUILTIN_LIBRARY, LIBRARY_GROUPS, type LibraryItem } from '../../lib/circuit/libraryCatalog';
import type { CircuitLayout } from '../../lib/circuit/types';
import { noFocusMouseDown } from './noFocus';

interface Props { onClose(): void; geminiApiKey?: string }

const btn = 'flex h-8 items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 text-xs text-white/80 hover:bg-white/10 disabled:opacity-30';
const icon = (name: string) => <span className="material-symbols-outlined text-[18px]">{name}</span>;
const ALIGN: [AlignMode, string, string][] = [
  ['left', 'align_horizontal_left', 'Căn trái'], ['hcenter', 'align_horizontal_center', 'Căn giữa (cùng cột)'], ['right', 'align_horizontal_right', 'Căn phải'],
  ['top', 'align_vertical_top', 'Căn trên'], ['vcenter', 'align_vertical_center', 'Căn giữa (cùng hàng)'], ['bottom', 'align_vertical_bottom', 'Căn dưới'],
];

export default function CircuitStudio({ onClose, geminiApiKey }: Props) {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [project, setProject] = useState<CircuitProject | null>(null);
  const [state, dispatch] = useReducer(studioReducer, initialStudioState(emptyLayout()));
  const [selection, setSelection] = useState<Selection>({ parts: [], wire: null });
  const [partsVersion, setPartsVersion] = useState(0);
  const [zoom, setZoom] = useState(0.6);
  const [wizard, setWizard] = useState<{ existing?: CustomPartEntry } | null>(null);
  const [itemMenu, setItemMenu] = useState<{ x: number; y: number; code: string } | null>(null);
  const [showLibrary, setShowLibrary] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const [placing, setPlacing] = useState<{ item: LibraryItem; x: number; y: number } | null>(null);
  // Không mở / tạo được mạch nào: chặn bàn vẽ (sửa mà không lưu được thì mất)
  const [openError, setOpenError] = useState<string | null>(null);
  const apiRef = useRef<CanvasApi | null>(null);
  // Vừa khung sau khi mở / tạo mạch: đợi bàn vẽ nhận bố cục mới rồi mới tính (gọi ngay thì còn bố cục cũ)
  const fitPending = useRef(false);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<CircuitProject | null>(null);
  projectRef.current = project;
  const layoutRef = useRef<CircuitLayout>(state.layout);
  layoutRef.current = state.layout;

  const layout = state.layout;
  useEffect(() => {
    if (!fitPending.current) return;
    fitPending.current = false;
    apiRef.current?.fit();
  }, [layout]);
  // Chỉ đi dây lại khi hình học đổi (sửa nhãn / màu dây / tên chân không cần)
  const routeSig = useMemo(() => routingSignature(layout, partsVersion), [layout, partsVersion]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const routed = useMemo(() => routeWorld(layout), [routeSig]);
  const issues = useMemo(() => { const v = validateLayout(layout, undefined, routed, { frame: false }); return [...v.errors, ...v.warnings]; }, [layout, routed]);
  const library = useMemo<LibraryItem[]>(() => [
    ...BUILTIN_LIBRARY,
    ...listCustomParts().map((c) => ({ type: c.file.code, name: c.file.name, group: LIBRARY_GROUPS.includes(c.file.group) ? c.file.group : 'Của tôi' })),
  ], [partsVersion]);

  const flash = useCallback((msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast((t) => (t?.msg === msg ? null : t)), 4000);
  }, []);
  // Mọi thay đổi đều đồng bộ dây chạm (pin rời đặt chạm đầu nhau thì tự nối, kéo ra thì tự bỏ),
  // rồi ghim dây: chỉ dây mới nối / vừa bấm "tự đi lại" được đi dây, dây khác đứng yên
  const commit = useCallback((l: CircuitLayout) => dispatch({ type: 'commit', layout: pinAutoWires(syncContacts(l)) }), []);

  // Ghi file lần lượt theo thứ tự gọi: bản ghi sau luôn đè bản trước (tự lưu đang chạy không đè tên vừa đổi)
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const queueSave = useCallback((p: CircuitProject) => {
    const r = saveChain.current.then(() => saveProject(p));
    saveChain.current = r.catch(() => undefined);
    return r;
  }, []);
  /** Cập nhật mạch đang mở sau khi ghi xong — bỏ qua nếu đã đổi sang mạch khác hoặc đã có bản mới hơn. */
  const applySaved = useCallback((next: CircuitProject) => {
    setProject((cur) => (cur && cur.id === next.id && cur.updatedAt <= next.updatedAt ? next : cur));
  }, []);

  // Hoàn tác / làm lại / đổi bố cục: bỏ lựa chọn trỏ tới linh kiện / dây không còn
  useEffect(() => { setSelection((s) => pruneSelection(layout, s)); }, [layout]);

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
    await queueSave(next);
    projectRef.current = next;
    applySaved(next);
  }, [queueSave, applySaved]);

  /** Ghi bản đang mở; lỗi thì báo và trả false để không đổi mạch / không đóng. */
  const safeFlush = useCallback(async () => {
    try { await flush(); return true; } catch (e) { flash(`Lỗi lưu: ${(e as Error).message ?? e}`, true); return false; }
  }, [flush, flash]);

  /** Mở cửa sổ sửa linh kiện tự thêm (từ menu thư viện hoặc nút trong bảng chỉnh). */
  const editCustomPart = useCallback(async (code: string) => {
    // Linh kiện đang dùng: báo trước (vẫn cho sửa) — đổi tên / xoá chân làm đứt dây nối vào chân đó
    if (await safeFlush()) {
      try {
        const using = await projectsUsingPart(code);
        if (using.length) flash(`Đổi tên/xoá chân sẽ làm đứt dây trong: ${using.join(', ')}`, true);
      } catch { /* không đọc được danh sách: vẫn cho sửa */ }
    }
    const existing = listCustomParts().find((c) => c.file.code === code);
    if (existing) setWizard({ existing });
  }, [safeFlush, flash]);

  /** Mở 1 mạch; trả false nếu không mở được (đã báo lỗi). */
  const openProject = useCallback(async (id: string) => {
    if (!(await safeFlush())) return false;
    try {
      const p = await loadProject(id);
      projectRef.current = p;
      setProject(p);
      setOpenError(null);
      // Mạch cũ còn dây tự đi → ghim đúng đường đang thấy, lần nối dây sau chúng không nhảy
      dispatch({ type: 'load', layout: pinAutoWires(p.layout) });
      setSelection({ parts: [], wire: null });
      fitPending.current = true;
      return true;
    } catch (e) {
      flash(`Không mở được mạch: ${(e as Error).message}`, true);
      return false;
    }
  }, [safeFlush, flash]);

  /** Tạo mạch mới; trả false nếu không ghi được file (đã báo lỗi). */
  const createProject = useCallback(async () => {
    if (!(await safeFlush())) return false;
    const p = newProject(`Mạch ${new Date().toLocaleDateString('vi-VN')}`);
    try {
      await queueSave(p);
    } catch (e) {
      flash(`Không tạo được mạch mới: ${(e as Error).message ?? e}`, true);
      return false;
    }
    projectRef.current = p;
    setProject(p);
    setOpenError(null);
    dispatch({ type: 'load', layout: p.layout });
    setSelection({ parts: [], wire: null });
    fitPending.current = true;
    try { await refreshList(); } catch (e) { flash(`Không đọc được danh sách mạch: ${(e as Error).message ?? e}`, true); }
    return true;
  }, [safeFlush, queueSave, refreshList, flash]);

  /** Mở mạch mới nhất (hoặc tạo mạch mới); không được thì hiện thông báo chặn bàn vẽ. */
  const openFirst = useCallback(async () => {
    let reason = '';
    try {
      const list = await refreshList();
      if (list[0] && await openProject(list[0].id)) return;
      if (await createProject()) return;
      reason = list[0] ? 'không đọc được mạch gần nhất và không tạo được mạch mới.' : 'không tạo được mạch mới.';
    } catch (e) {
      reason = `không đọc được thư mục mạch (${(e as Error).message ?? e}).`;
    }
    if (!projectRef.current) setOpenError(`Không mở được mạch — ${reason}`);
  }, [refreshList, openProject, createProject]);

  useEffect(() => {
    (async () => {
      // Linh kiện tự thêm hỏng / không đọc được không được chặn việc mở mạch
      try {
        const partErrors = await loadCustomParts();
        if (partErrors.length) flash(partErrors.join(' '), true);
      } catch (e) {
        flash(`Không đọc được linh kiện tự thêm: ${(e as Error).message ?? e}`, true);
      }
      setPartsVersion((v) => v + 1);
      await openFirst();
    })();
  }, []);

  // Menu chuột phải linh kiện: đóng khi bấm ra ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!itemMenu) return;
    const close = () => setItemMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', onKey); };
  }, [itemMenu]);

  // Tự lưu sau ~1 giây kể từ lần thay đổi cuối
  useEffect(() => {
    if (!project || project.layout === layout) return;
    const t = setTimeout(() => {
      const next = { ...project, layout, updatedAt: new Date().toISOString() };
      queueSave(next).then(() => { applySaved(next); refreshList().catch(() => undefined); }).catch((e) => flash(`Lỗi lưu: ${e}`, true));
    }, 1000);
    return () => clearTimeout(t);
  }, [layout, project]);

  const close = async () => { if (!(await safeFlush())) return; onClose(); };

  // ─── Kéo linh kiện từ thư viện vào bàn vẽ ───
  useEffect(() => {
    if (!placing) return;
    window.getSelection()?.removeAllRanges();
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
      // Thả pin rời sát đầu pin khác → hít vào cho chạm
      const s = contactSnap(res.layout, [res.id], 0, 0);
      commit(s.snapped ? movePartsBy(res.layout, [res.id], s.dx, s.dy) : res.layout);
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
      if (exporting || wizard) return; // cửa sổ Xuất ảnh / Thêm linh kiện đang mở: không bắt phím của bàn vẽ
      if (!project) { if (e.key === 'Delete' || e.key === 'Backspace' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z')) e.stopPropagation(); return; }
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
      if (typing) return;
      const cmd = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      const handled = (cmd && (k === 'z' || (k === 'd' && selection.parts.length > 0))) || e.key === 'Delete' || e.key === 'Backspace'
        || (k === 'r' && !cmd && selection.parts.length > 0) || e.key === '0' || e.key === 'Escape'
        || (!cmd && (e.key === '-' || e.key === '=' || e.key === '+'));
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
      if (e.key === '-') { apiRef.current?.zoomBy(1 / 1.25); return; }
      if (e.key === '=' || e.key === '+') { apiRef.current?.zoomBy(1.25); return; }
      // Esc: đang kéo dở thì huỷ thao tác kéo (không ghi), không thì bỏ chọn
      if (e.key === 'Escape' && !apiRef.current?.cancelDrag()) setSelection({ parts: [], wire: null });
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [layout, selection, commit, flash, exporting, wizard, project]);

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
    <div className="circuit-studio fixed inset-0 z-[100] overflow-hidden bg-[#141414] text-white">
      <div ref={canvasWrapRef} className="absolute inset-0">
        <StudioCanvas
          layout={layout}
          routed={routed}
          selection={selection}
          onSelect={setSelection}
          onZoomChange={setZoom}
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
          onRename={async (name) => {
            if (!project) return;
            const next = { ...project, name, layout, updatedAt: new Date().toISOString() };
            try { await queueSave(next); applySaved(next); await refreshList(); } catch (e) { flash(`Lỗi lưu: ${(e as Error).message ?? e}`, true); }
          }}
          onDuplicate={async () => {
            if (!project) return;
            if (!(await safeFlush())) return;
            const d = duplicateProject({ ...project, layout });
            try { await queueSave(d); await refreshList(); } catch (e) { flash(`Không nhân bản được: ${(e as Error).message ?? e}`, true); return; }
            await openProject(d.id);
          }}
          onDelete={async () => {
            if (!project || !(await ask(`Xoá mạch "${project.name}"? Không khôi phục được.`, { title: 'Xoá mạch', kind: 'warning' }))) return;
            try { await deleteProject(project.id); } catch (e) { flash(`Không xoá được mạch: ${(e as Error).message ?? e}`, true); return; }
            projectRef.current = null;
            setProject(null);
            dispatch({ type: 'load', layout: emptyLayout() });
            await openFirst();
          }}
        />
        <div className="mx-1 h-6 w-px bg-white/10" />
        <button onMouseDown={noFocusMouseDown} className={btn} title="Thư viện linh kiện" onClick={() => setShowLibrary(!showLibrary)}>{icon('widgets')} Linh kiện</button>
        <button onMouseDown={noFocusMouseDown} className={btn} title="Hoàn tác (Cmd+Z)" disabled={!state.past.length} onClick={() => dispatch({ type: 'undo' })}>{icon('undo')}</button>
        <button onMouseDown={noFocusMouseDown} className={btn} title="Làm lại (Cmd+Shift+Z)" disabled={!state.future.length} onClick={() => dispatch({ type: 'redo' })}>{icon('redo')}</button>
        <button onMouseDown={noFocusMouseDown} className={btn} title="Thu nhỏ (phím -)" onClick={() => apiRef.current?.zoomBy(1 / 1.25)}>{icon('zoom_out')}</button>
        <span className="w-10 text-center text-xs tabular-nums text-white/60">{Math.round(zoom * 100)}%</span>
        <button onMouseDown={noFocusMouseDown} className={btn} title="Phóng to (phím =)" onClick={() => apiRef.current?.zoomBy(1.25)}>{icon('zoom_in')}</button>
        <button onMouseDown={noFocusMouseDown} className={btn} title="Vừa màn hình (phím 0)" onClick={() => apiRef.current?.fit()}>{icon('fit_screen')}</button>
        <button onMouseDown={noFocusMouseDown} className={btn} title="Tự đi lại tất cả dây (bỏ mọi chỉnh tay)" onClick={() => commit(resetAllWires(layout))}>{icon('route')}</button>
        {selParts >= 2 && (
          <>
            <div className="mx-1 h-6 w-px bg-white/10" />
            {ALIGN.map(([mode, ic, title]) => <button key={mode} onMouseDown={noFocusMouseDown} className={btn} title={title} onClick={() => commit(alignParts(layout, selection.parts, mode))}>{icon(ic)}</button>)}
            <button onMouseDown={noFocusMouseDown} className={btn} title="Chia đều ngang" disabled={selParts < 3} onClick={() => commit(distributeParts(layout, selection.parts, 'x'))}>{icon('horizontal_distribute')}</button>
            <button onMouseDown={noFocusMouseDown} className={btn} title="Chia đều dọc" disabled={selParts < 3} onClick={() => commit(distributeParts(layout, selection.parts, 'y'))}>{icon('vertical_distribute')}</button>
          </>
        )}
        <div className="flex-1" />
        {toast && <span className={`text-xs ${toast.error ? 'text-red-400' : 'text-emerald-400'}`}>{toast.msg}</span>}
        <button onMouseDown={noFocusMouseDown} className="flex h-8 items-center gap-1 rounded-md bg-[#F1641E] px-3 text-xs font-semibold text-white hover:bg-[#F1641E]/90 disabled:opacity-30"
          disabled={!layout.parts.length} onClick={() => setExporting(true)}>{icon('download')} Xuất ảnh</button>
        <button onMouseDown={noFocusMouseDown} className={btn} title="Đóng" onClick={close}>{icon('close')}</button>
      </div>

      {showLibrary && (
        <FloatingPanel id="library" title="Linh kiện" defaultPos={{ x: 12, y: 72 }} width={230} onClose={() => setShowLibrary(false)}>
          <PartLibraryPanel
            items={library}
            version={partsVersion}
            onStartPlace={(item, e) => setPlacing({ item, x: e.clientX, y: e.clientY })}
            onAddNew={() => setWizard({})}
            onItemMenu={(item, e) => { if (listCustomParts().some((c) => c.file.code === item.type)) setItemMenu({ x: e.clientX, y: e.clientY, code: item.type }); }}
          />
        </FloatingPanel>
      )}

      {hasSelection && (
        <FloatingPanel id="inspector" title={selection.wire !== null ? `Dây ${selection.wire + 1}` : selParts === 1 ? `Linh kiện ${selection.parts[0]}` : `${selParts} linh kiện`}
          defaultPos={{ x: window.innerWidth - 264, y: 72 }} width={252}>
          <InspectorPanel key={selection.wire !== null ? `w${selection.wire}` : selection.parts.join(',')} layout={layout} selection={selection} onCommit={commit} onSelect={setSelection} onError={(m) => flash(m, true)} getLayout={() => layoutRef.current} onEditCustomPart={editCustomPart} />
        </FloatingPanel>
      )}

      <WarningsBar messages={issues} onPick={pickWarning} />

      {/* Chưa có mạch đang mở: chặn bàn vẽ (sửa lúc này không lưu được) */}
      {!project && (
        <div className="absolute inset-0 z-[25] flex items-center justify-center bg-[#141414]/85">
          {openError ? (
            <div className="max-w-md rounded-xl border border-white/10 bg-[#1f1f1f] p-5 text-center text-sm shadow-2xl">
              <div className="mb-3 text-red-400">{openError}</div>
              <button className="rounded-md bg-[#F1641E] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#F1641E]/90"
                onClick={() => { setOpenError(null); openFirst(); }}>Thử lại</button>
            </div>
          ) : (
            <div className="text-sm text-white/50">Đang mở mạch…</div>
          )}
        </div>
      )}

      {placing && (
        <img alt="" className="pointer-events-none fixed z-[110] h-16 w-16 -translate-x-1/2 -translate-y-1/2 opacity-80"
          style={{ left: placing.x, top: placing.y }}
          src={'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(partPreviewSvg(placing.item.type, 64))} />
      )}
      {exporting && project && (
        <ExportDialog
          layout={layout}
          routed={routed}
          selectedIds={selection.parts}
          projectName={project.name}
          settings={project.exportSettings}
          onClose={() => setExporting(false)}
          onError={(m) => flash(m, true)}
          onSaved={async (s, titleTop, titleBottom) => {
            setExporting(false);
            const nextLayout = titleTop !== (layout.titleTop ?? '') || titleBottom !== (layout.titleBottom ?? '') ? { ...layout, titleTop, titleBottom } : layout;
            if (nextLayout !== layout) commit(nextLayout);
            const next = { ...project, layout: nextLayout, exportSettings: s, updatedAt: new Date().toISOString() };
            try {
              await queueSave(next);
              applySaved(next);
              await refreshList();
              flash('Đã xuất ảnh.');
            } catch (e) {
              flash(`Lỗi lưu: ${(e as Error).message ?? e}`, true);
            }
          }}
        />
      )}
      {itemMenu && (
        <div className="fixed z-[115] rounded-lg border border-white/10 bg-[#1f1f1f] py-1 text-sm shadow-xl" style={{ left: Math.min(itemMenu.x + 4, window.innerWidth - 220), top: Math.min(itemMenu.y + 4, window.innerHeight - 90) }} onPointerDown={(e) => e.stopPropagation()}>
          <button className="block w-full px-4 py-1.5 text-left hover:bg-white/10" onClick={() => { const code = itemMenu.code; setItemMenu(null); editCustomPart(code); }}>Sửa chân / đổi ảnh</button>
          <button className="block w-full px-4 py-1.5 text-left text-red-400 hover:bg-white/10" onClick={async () => {
            const code = itemMenu.code;
            setItemMenu(null);
            if (!(await safeFlush())) return;
            const using = await projectsUsingPart(code);
            if (using.length) { flash(`Không xoá được — đang dùng trong: ${using.join(', ')}`, true); return; }
            if (!(await ask('Xoá linh kiện này khỏi thư viện?', { title: 'Xoá linh kiện', kind: 'warning' }))) return;
            await deleteCustomPart(code);
            setPartsVersion((v) => v + 1);
          }}>Xoá khỏi thư viện</button>
        </div>
      )}
      {wizard && (
        <AddPartWizard
          existing={wizard.existing}
          geminiApiKey={geminiApiKey}
          onClose={() => setWizard(null)}
          onSaved={() => { setWizard(null); setPartsVersion((v) => v + 1); flash('Đã lưu linh kiện vào thư viện.'); }}
        />
      )}
    </div>
  );
}
