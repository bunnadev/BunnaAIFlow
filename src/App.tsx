import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
Controls,
Edge,
addEdge,
Node,
Connection,
ReactFlowProvider,
useNodesState,
useEdgesState,
Panel,
MarkerType,
useReactFlow,
SelectionMode,
Background,
BackgroundVariant
} from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';

// Custom Nodes & Components
import MediaSourceNode from './components/nodes/MediaSourceNode';
import ImageGenNode from './components/nodes/ImageGenNode';
import VideoGenNode from './components/nodes/VideoGenNode';
import TextGenNode from './components/nodes/TextGenNode';
import SttNode from './components/nodes/SttNode';
import TextReviewNode from './components/nodes/TextReviewNode';
import VbeeNode from './components/nodes/VbeeNode';
import AudioMasterNode from './components/nodes/AudioMasterNode';
import ScenePlannerNode from './components/nodes/ScenePlannerNode';
import SceneReviewNode from './components/nodes/SceneReviewNode';
import CharacterNode from './components/nodes/CharacterNode';
import StyleNode from './components/nodes/StyleNode';
import DeleteEdge from './components/nodes/DeleteEdge';
import WorkspaceManager from './components/WorkspaceManager';
import ContextMenu from './components/ContextMenu';
import NodeSettingsPanel from './components/NodeSettingsPanel';
import StyleSettingsModal from './components/StyleSettingsModal';
import SceneEditPanel from './components/SceneEditPanel';
import NodeLibraryPanel from './components/NodeLibraryPanel';
import ExecutionLogPanel from './components/ExecutionLogPanel';
import BatchExportPanel from './components/BatchExportPanel';
import BatchCombinedModal from './components/BatchCombinedModal';
import SettingsPanel from './components/SettingsPanel';
import LicenseGate from './components/LicenseGate';
import ImportChoiceModal from './components/ImportChoiceModal';
import ImportAllChoiceModal from './components/ImportAllChoiceModal';
import AboutModal from './components/AboutModal';
import { QuickPreviewModal } from './components/UI';

import type { Workspace, LogEntry, MediaAsset } from './types';
import { loadSettings, saveSettings, type AppSettings } from './lib/settings';
import { loadWorkspaceState, saveWorkspaceState } from './lib/workspaceStore';
import { exportSingleWorkspace, exportAllWorkspaces, importWorkspaces, type ImportedBundle } from './lib/exportImport';
import { saveAssetFromBase64, saveAssetFromBytes, readAssetAsBase64, deleteAsset } from './lib/assets';
import { GeminiImageProvider } from './lib/providers/geminiImageProvider';
import { GeminiVideoProvider } from './lib/providers/geminiVideoProvider';
import { GeminiOmniFlashProvider } from './lib/providers/geminiOmniFlashProvider';
import { GeminiTextProvider } from './lib/providers/geminiTextProvider';
import { VbeeProvider } from './lib/providers/vbeeProvider';
import { DEFAULT_VBEE_VOICE_NAME, resolveVbeeVoiceCode } from './lib/vbeeVoices';
import { buildScenesSkeleton } from './lib/sceneGrouping';
import { computeFanOut } from './lib/fanOut';
import { CHARACTER_ANGLES } from './lib/characterAngles';
import { computeBulkConnectEdges } from './lib/bulkConnect';
import { resolveImageModelId, resolveVideoModelId, resolveTextModelId } from './lib/models';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { writeFile, readFile } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

export const getNodeFileName = (node: Node, index: number, prefix: string = 'BUNNA_FLOW') => {
const typeCode = node.type === 'imageGen' ? 'IMG' : (node.type === 'videoGen' ? 'VID' : ((node.type === 'vbee' || node.type === 'audioMaster') ? 'AUD' : ((node.type === 'scenePlanner' || node.type === 'sceneReview') ? 'SCN' : (node.type === 'character' ? 'CHR' : ((node.type === 'textGen' || node.type === 'stt' || node.type === 'textReview') ? 'TXT' : 'RES')))));
const extension = node.data.result?.type === 'video' ? 'mp4' : (node.data.result?.type === 'text' ? 'txt' : (node.data.result?.type === 'audio' ? 'wav' : (node.data.result?.type === 'sceneList' ? 'json' : 'jpg')));
const label = (node.data.label || 'ASSET').replace(/[^a-z0-9]/gi, '_').toUpperCase();
return `${prefix}_${typeCode}_${index + 1}_${label}.${extension}`;
};

const NODE_TYPES = {
mediaSource: MediaSourceNode,
imageGen: ImageGenNode,
videoGen: VideoGenNode,
textGen: TextGenNode,
stt: SttNode,
textReview: TextReviewNode,
vbee: VbeeNode,
audioMaster: AudioMasterNode,
scenePlanner: ScenePlannerNode,
sceneReview: SceneReviewNode,
character: CharacterNode,
styleNode: StyleNode,
};

const EDGE_TYPES = {
default: DeleteEdge,
};


type InteractionMode = 'select' | 'hand' | 'connect';
type ExecutionMode = 'single' | 'sequence';

interface UndoState {
nodes: Node[];
edges: Edge[];
}

const FlowApp: React.FC = () => {
const [workspaces, setWorkspaces] = useState<Workspace[]>([
{ id: uuidv4(), name: 'Workflow 1', nodes: [], edges: [] }
]);
const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
const [isHydrated, setIsHydrated] = useState(false);
const [interactionMode, setInteractionMode] = useState<InteractionMode>('select');

const [menuState, setMenuState] = useState<{ x: number, y: number, flowPos: { x: number, y: number }, visible: boolean } | null>(null);
const [isNodeLibraryOpen, setIsNodeLibraryOpen] = useState(false);
const [isLogPanelOpen, setIsLogPanelOpen] = useState(false);
const [isSettingsOpen, setIsSettingsOpen] = useState(false);
const [executionLogs, setExecutionLogs] = useState<LogEntry[]>([]);

const [isBatchCombinedModalOpen, setIsBatchCombinedModalOpen] = useState(false);
const [previewDataState, setPreviewDataState] = useState<{ open: boolean; type: 'image' | 'video'; src: string; title?: string; } | null>(null);
const [pendingImport, setPendingImport] = useState<ImportedBundle | null>(null);

const [filenamePrefix, setFilenamePrefix] = useState('BUNNA_FLOW');
const [concurrency] = useState(2);
const [isStopping, setIsStopping] = useState(false);

const [flowStatus, setFlowStatus] = useState<{ message: string, type: 'info' | 'error' | 'success' | 'warning', canUndo?: boolean } | null>(null);
const [runningChain, setRunningChain] = useState(false);

const [activeSettingsNodeId, setActiveSettingsNodeId] = useState<string | null>(null);
const [activeStyleSettingsNodeId, setActiveStyleSettingsNodeId] = useState<string | null>(null);
const [activeSceneEdit, setActiveSceneEdit] = useState<{ nodeId: string; sceneId: string } | null>(null);

const [appSettings, setAppSettings] = useState<AppSettings>({});

const [nodes, setNodes, onNodesChange] = useNodesState([]);
const [edges, setEdges, onEdgesChange] = useEdgesState([]);

const [undoStack, setUndoStack] = useState<UndoState[]>([]);
const { screenToFlowPosition, getNodes, getEdges, setViewport, getViewport } = useReactFlow();

const stopFlagRef = useRef(false);
const activeJobsRef = useRef(0);
const [, setActiveJobsTick] = useState(0);
const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// --- Khởi tạo: nạp settings + workspace đã lưu cục bộ ---
useEffect(() => {
(async () => {
const settings = await loadSettings();
setAppSettings(settings);

const stored = await loadWorkspaceState();
if (stored && stored.workspaces.length > 0) {
setWorkspaces(stored.workspaces);
const active = stored.workspaces.find(w => w.id === stored.activeWorkspaceId) ?? stored.workspaces[0];
setActiveWorkspaceId(active.id);
setNodes(active.nodes || []);
setEdges(active.edges || []);
if (active.viewport) setViewport(active.viewport);
} else {
setActiveWorkspaceId(workspaces[0].id);
}
setIsHydrated(true);
// eslint-disable-next-line react-hooks/exhaustive-deps
})();
}, []);

// --- Auto-save workspace xuống đĩa (debounce) ---
useEffect(() => {
if (!isHydrated || !activeWorkspaceId) return;
if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
saveTimerRef.current = setTimeout(() => {
const fullWorkspaces = workspaces.map(ws => ws.id === activeWorkspaceId ? {
...ws, nodes, edges, viewport: getViewport()
} : ws);
saveWorkspaceState({ workspaces: fullWorkspaces, activeWorkspaceId }).catch(console.error);
}, 1000);
return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
}, [nodes, edges, workspaces, activeWorkspaceId, isHydrated, getViewport]);

// appSettings đọc qua ref để tránh stale closure: executeWorkflow được memo hoá
// bằng useCallback với dependency array cố định, nên nếu runNodeLogic đọc thẳng
// biến appSettings từ scope ngoài, nó sẽ mãi mãi dùng giá trị của lần render đầu
// tiên (lúc key còn rỗng) dù sau đó người dùng đã lưu key mới trong Settings.
const appSettingsRef = useRef<AppSettings>({});
useEffect(() => { appSettingsRef.current = appSettings; }, [appSettings]);

// Keyboard Shortcuts (Ctrl+Z)
useEffect(() => {
const handleKeyDown = (e: KeyboardEvent) => {
if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
e.preventDefault();
handleUndo();
}
};
window.addEventListener('keydown', handleKeyDown);
return () => window.removeEventListener('keydown', handleKeyDown);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [undoStack]);

const handleUndo = useCallback(() => {
if (undoStack.length === 0) return;
const lastState = undoStack[undoStack.length - 1];
setNodes(lastState.nodes);
setEdges(lastState.edges);
setUndoStack(prev => prev.slice(0, -1));
setFlowStatus({ message: 'ĐÃ KHÔI PHỤC THAO TÁC', type: 'success' });
setTimeout(() => setFlowStatus(null), 2000);
}, [undoStack, setNodes, setEdges]);

const onNodesDelete = useCallback((_deleted: Node[]) => {
setUndoStack(prev => [...prev, { nodes: getNodes(), edges: getEdges() }]);
setFlowStatus({ message: 'ĐÃ XOÁ NODE. NHẤN CTRL+Z ĐỂ HOÀN TÁC', type: 'warning', canUndo: true });
setTimeout(() => setFlowStatus(null), 5000);
}, [getNodes, getEdges]);

const onEdgesDelete = useCallback((_deleted: Edge[]) => {
setUndoStack(prev => [...prev, { nodes: getNodes(), edges: getEdges() }]);
}, [getNodes, getEdges]);

const handleResetAllResults = useCallback(() => {
setNodes(nds => nds.map(node => {
if (node.type === 'imageGen' || node.type === 'videoGen' || node.type === 'textGen' || node.type === 'stt' || node.type === 'vbee' || node.type === 'audioMaster' || node.type === 'scenePlanner' || node.type === 'character') {
return {
...node,
data: { ...node.data, result: null, statusText: '', isFinalized: false, isLoading: false }
};
}
return node;
}));
setFlowStatus({ message: 'ĐÃ RESET KẾT QUẢ CÁC NODE', type: 'info' });
setTimeout(() => setFlowStatus(null), 2000);
}, [setNodes]);

const saveCurrentToWorkspace = useCallback(() => {
setWorkspaces(prev => prev.map(ws => ws.id === activeWorkspaceId ? {
...ws, nodes, edges, viewport: getViewport()
} : ws));
}, [activeWorkspaceId, nodes, edges, getViewport]);

const handleSelectWorkspace = useCallback((id: string) => {
saveCurrentToWorkspace();
const target = workspaces.find(w => w.id === id);
if (target) {
setActiveWorkspaceId(id);
setNodes(target.nodes || []);
setEdges(target.edges || []);
if (target.viewport) setViewport(target.viewport);
}
}, [saveCurrentToWorkspace, workspaces, setNodes, setEdges, setViewport]);

const handleAddWorkspace = useCallback(() => {
saveCurrentToWorkspace();
const newId = uuidv4();
const newWs: Workspace = { id: newId, name: `Workflow ${workspaces.length + 1}`, nodes: [], edges: [] };
setWorkspaces(prev => [...prev, newWs]);
setActiveWorkspaceId(newId);
setNodes([]);
setEdges([]);
}, [saveCurrentToWorkspace, workspaces.length, setNodes, setEdges]);

const handleDeleteWorkspace = useCallback((id: string) => {
if (workspaces.length <= 1) return;
const remaining = workspaces.filter(w => w.id !== id);
setWorkspaces(remaining);
if (activeWorkspaceId === id) {
const first = remaining[0];
setActiveWorkspaceId(first.id);
setNodes(first.nodes);
setEdges(first.edges);
if (first.viewport) setViewport(first.viewport);
}
}, [workspaces, activeWorkspaceId, setNodes, setEdges, setViewport]);

const handleRenameWorkspace = useCallback((id: string, name: string) => {
setWorkspaces(prev => prev.map(ws => ws.id === id ? { ...ws, name } : ws));
}, []);

const handleExport = useCallback(async () => {
const current = workspaces.find(ws => ws.id === activeWorkspaceId);
if (!current) return;
const liveWorkspace: Workspace = { ...current, nodes, edges, viewport: getViewport() };
try {
const didSave = await exportSingleWorkspace(liveWorkspace);
if (didSave) {
setFlowStatus({ message: 'ĐÃ XUẤT WORKFLOW ĐANG MỞ', type: 'success' });
setTimeout(() => setFlowStatus(null), 2500);
}
} catch (err) {
console.error('Export failed:', err);
setFlowStatus({ message: 'LỖI KHI XUẤT FILE', type: 'error' });
setTimeout(() => setFlowStatus(null), 2500);
}
}, [workspaces, activeWorkspaceId, nodes, edges, getViewport]);

const handleExportAll = useCallback(async () => {
const fullWorkspaces = workspaces.map(ws => ws.id === activeWorkspaceId ? {
...ws, nodes, edges, viewport: getViewport()
} : ws);
try {
const didSave = await exportAllWorkspaces(fullWorkspaces, activeWorkspaceId);
if (didSave) {
setFlowStatus({ message: `ĐÃ XUẤT TẤT CẢ ${fullWorkspaces.length} WORKFLOW`, type: 'success' });
setTimeout(() => setFlowStatus(null), 2500);
}
} catch (err) {
console.error('Export all failed:', err);
setFlowStatus({ message: 'LỖI KHI XUẤT FILE', type: 'error' });
setTimeout(() => setFlowStatus(null), 2500);
}
}, [workspaces, activeWorkspaceId, nodes, edges, getViewport]);

const handleImport = useCallback(async () => {
try {
const result = await importWorkspaces();
if (!result) return;
setPendingImport(result);
} catch (err) {
console.error('Import failed:', err);
setFlowStatus({ message: 'LỖI ĐỊNH DẠNG HOẶC FILE HỎNG', type: 'error' });
setTimeout(() => setFlowStatus(null), 3000);
}
}, []);

const handleImportCancel = useCallback(() => setPendingImport(null), []);

const handleImportReplace = useCallback(() => {
if (!pendingImport) return;
const imported = pendingImport.workspaces.find(w => w.id === pendingImport.activeWorkspaceId) ?? pendingImport.workspaces[0];
const rest = pendingImport.workspaces.filter(w => w !== imported).map(w => ({ ...w, id: uuidv4() }));

setWorkspaces(prev => [...prev.map(ws => ws.id === activeWorkspaceId ? { ...ws, nodes: imported.nodes, edges: imported.edges, viewport: imported.viewport } : ws), ...rest]);
setNodes(imported.nodes || []);
setEdges(imported.edges || []);
if (imported.viewport) setViewport(imported.viewport);

setPendingImport(null);
setFlowStatus({ message: 'ĐÃ GHI ĐÈ WORKFLOW ĐANG MỞ', type: 'success' });
setTimeout(() => setFlowStatus(null), 2500);
}, [pendingImport, activeWorkspaceId, setNodes, setEdges, setViewport]);

const handleImportCreateNew = useCallback(() => {
if (!pendingImport) return;
saveCurrentToWorkspace();

const freshWorkspaces = pendingImport.workspaces.map(w => ({ ...w, id: uuidv4() }));
const markedIndex = pendingImport.workspaces.findIndex(w => w.id === pendingImport.activeWorkspaceId);
const first = freshWorkspaces[markedIndex >= 0 ? markedIndex : 0];

setWorkspaces(prev => [...prev, ...freshWorkspaces]);
setActiveWorkspaceId(first.id);
setNodes(first.nodes || []);
setEdges(first.edges || []);
if (first.viewport) setViewport(first.viewport);

setPendingImport(null);
setFlowStatus({ message: 'ĐÃ TẠO WORKFLOW MỚI TỪ FILE NHẬP', type: 'success' });
setTimeout(() => setFlowStatus(null), 2500);
}, [pendingImport, saveCurrentToWorkspace, setNodes, setEdges, setViewport]);

const handleImportAllReplace = useCallback(() => {
if (!pendingImport || pendingImport.workspaces.length === 0) return;
const newWorkspaces = pendingImport.workspaces;
const first = newWorkspaces.find(w => w.id === pendingImport.activeWorkspaceId) ?? newWorkspaces[0];

setWorkspaces(newWorkspaces);
setActiveWorkspaceId(first.id);
setNodes(first.nodes || []);
setEdges(first.edges || []);
if (first.viewport) setViewport(first.viewport);

setPendingImport(null);
setFlowStatus({ message: 'ĐÃ THAY THẾ TOÀN BỘ WORKFLOW', type: 'success' });
setTimeout(() => setFlowStatus(null), 2500);
}, [pendingImport, setNodes, setEdges, setViewport]);

const getNodeStateHash = useCallback((node: Node, currentEdges: Edge[]) => {
const currentNodes = getNodes();
const incomingMediaEdges = currentEdges.filter(e => e.target === node.id && e.targetHandle === 'media-in');
const incomingMediaIds = incomingMediaEdges.map(e => {
const srcNode = currentNodes.find(n => n.id === e.source);
return srcNode?.data?.result?.assetId || srcNode?.data?.media?.assetId || '';
}).sort().join('|');

const incomingStyleEdges = currentEdges.filter(e => e.target === node.id && e.targetHandle === 'style-in');
const styleStrings = incomingStyleEdges.map(e => {
const srcNode = currentNodes.find(n => n.id === e.source);
if (srcNode?.type === 'styleNode') {
return `${srcNode.data.positivePrompt || ''}|${srcNode.data.negativePrompt || ''}`;
}
return '';
}).sort().join('|');

const incomingTextEdges = currentEdges.filter(e => e.target === node.id && e.targetHandle === 'text-in');
const incomingTextHash = incomingTextEdges.map(e => {
const srcNode = currentNodes.find(n => n.id === e.source);
return srcNode?.data?.result?.type === 'text' ? (srcNode.data.result.text || '') : '';
}).sort().join('|');

const incomingCharacterEdges = currentEdges.filter(e => e.target === node.id && e.targetHandle?.startsWith('character-in-'));
const incomingCharacterHash = incomingCharacterEdges.map(e => {
const srcNode = currentNodes.find(n => n.id === e.source);
const r = srcNode?.data?.result;
return `${e.targetHandle}:${r?.type === 'imageSet' ? r.images.map((i: any) => i.assetId).join(',') : (r?.assetId || '')}`;
}).sort().join('|');

const baseParts = [node.data.model, node.data.localPrompt, node.data.aspectRatio, node.data.resolution, node.data.duration, incomingMediaIds, styleStrings];
// Chỉ thêm phần text-in/Vbee/nhân vật vào hash cho những node THỰC SỰ có
// input đó — nếu thêm vô điều kiện cho mọi node, hash của các node cũ
// (imageGen/videoGen/textGen/stt đã chạy trước khi có các trường này) sẽ đổi
// dù input chẳng đổi gì, khiến isNodeDirty() coi chúng là "dirty" và chạy
// lại oan uổng (đã từng vấp lỗi này thật với text-in, không lặp lại).
if (incomingTextEdges.length > 0) baseParts.push(incomingTextHash);
if (node.type === 'vbee') baseParts.push(node.data.voiceLabel, node.data.speed, node.data.gapSeconds);
if (node.type === 'audioMaster') baseParts.push(node.data.targetLufs);
if (node.type === 'scenePlanner') baseParts.push(node.data.targetSceneSeconds);
if (node.type === 'character') baseParts.push(node.data.characterName);
// characterCount mặc định 0 cho MỌI node imageGen/videoGen kể cả những node
// không dùng tính năng này — chỉ thêm vào hash khi thực sự bật (>0), để
// không đổi hash của những node đã chạy trước khi tính năng này tồn tại.
if ((node.type === 'imageGen' || node.type === 'videoGen') && (node.data.characterCount ?? 0) > 0) {
baseParts.push(node.data.characterCount, incomingCharacterHash);
}
return baseParts.join('::');
}, [getNodes]);

const isNodeDirty = useCallback((node: Node, currentEdges: Edge[]) => {
if (!node.data.isFinalized || !node.data.result) return true;
return getNodeStateHash(node, currentEdges) !== node.data.lastRunHash;
}, [getNodeStateHash]);

const onAddManualNode = useCallback((type: string, customPos?: { x: number, y: number }) => {
const timestamp = Date.now();
const id = `${type}_${timestamp}`;
const flowViewport = getViewport();
const finalPos = customPos || { x: (flowViewport.x * -1) + 400, y: (flowViewport.y * -1) + 300 };
const commonData = { isLoading: false, statusText: '', result: null, isFinalized: false, isBatch: false };
let newNode: Node;
switch (type) {
case 'mediaSource': newNode = { id, type, position: finalPos, data: { ...commonData, label: 'Nguồn Media', media: null } }; break;
case 'imageGen': newNode = { id, type, position: finalPos, data: { ...commonData, label: 'Ảnh AI', model: 'Nano Banana Pro', aspectRatio: '16:9', resolution: '4k', localPrompt: '' } }; break;
case 'videoGen': newNode = { id, type, position: finalPos, data: { ...commonData, label: 'Video AI', model: 'Veo 3.1 - Lite', aspectRatio: '16:9', resolution: '720p', duration: 8, videoMode: 'frame', voiceOverEnabled: false, voiceOverVoice: 'Puck — Upbeat', localPrompt: '' } }; break;
case 'textGen': newNode = { id, type, position: finalPos, data: { ...commonData, label: 'Text AI', model: 'Gemini 2.5 Flash', localPrompt: '' } }; break;
case 'stt': newNode = { id, type, position: finalPos, data: { ...commonData, label: 'Tách Audio', model: 'Gemini 2.5 Flash', localPrompt: '' } }; break;
case 'textReview': newNode = { id, type, position: finalPos, data: { ...commonData, label: 'Duyệt Text', isFinalized: true, editedText: '' } }; break;
case 'vbee': newNode = { id, type, position: finalPos, data: { ...commonData, label: 'Vbee TTS', voiceLabel: DEFAULT_VBEE_VOICE_NAME, speed: 0.95, gapSeconds: 0.35, sampleRate: 48000 } }; break;
case 'audioMaster': newNode = { id, type, position: finalPos, data: { ...commonData, label: 'Làm Đẹp Âm Thanh', targetLufs: -14 } }; break;
case 'scenePlanner': newNode = { id, type, position: finalPos, data: { ...commonData, label: 'Phân Tích Cảnh', model: 'Gemini 3.6 Flash', targetSceneSeconds: 6.0 } }; break;
case 'sceneReview': newNode = { id, type, position: finalPos, data: { ...commonData, label: 'Duyệt Phân Cảnh', isFinalized: true, editedScenes: [] } }; break;
case 'character': newNode = { id, type, position: finalPos, data: { ...commonData, label: 'Nhân Vật', characterName: '', model: 'Nano Banana Pro', aspectRatio: '3:4' } }; break;
case 'styleNode': newNode = { id, type, position: finalPos, data: { ...commonData, label: 'Phong cách', positivePrompt: '', negativePrompt: '' } }; break;
default: return;
}
setNodes((nds) => nds.concat(newNode)); setMenuState(null);
}, [setNodes, getViewport]);

const onDuplicateNode = useCallback((nodeId: string) => {
const currentNodes = getNodes();
const targetNode = currentNodes.find(n => n.id === nodeId);
if (!targetNode) return;

const timestamp = Date.now();
const id = `${targetNode.type}_${timestamp}`;
const newNode: Node = {
...targetNode,
id,
selected: false,
dragging: false,
position: { x: targetNode.position.x + 40, y: targetNode.position.y + 40 },
data: {
...targetNode.data,
isLoading: false, statusText: '', result: null, isFinalized: false, isWaiting: false, isPaused: false
}
};
setNodes((nds) => nds.concat(newNode));
}, [getNodes, setNodes]);

const handleConnect = useCallback((p: Connection) => {
if (!p.source || !p.target) return;
const primaryEdge = { ...p, animated: false, style: { stroke: '#F1641E', strokeWidth: 3 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#F1641E' } };

const currentNodes = getNodes();
const currentEdges = getEdges();
const bulkEdges = computeBulkConnectEdges(currentNodes, p, currentEdges, `edge_bulk_${Date.now()}`);

setEdges(eds => addEdge(primaryEdge, eds).concat(bulkEdges));

if (bulkEdges.length > 0) {
setFlowStatus({ message: `ĐÃ NỐI THÊM TỚI ${bulkEdges.length} NODE ĐANG CHỌN.`, type: 'success' });
setTimeout(() => setFlowStatus(null), 2500);
}
}, [getNodes, getEdges, setEdges]);

const handleFanOutFromSelection = useCallback(() => {
const currentNodes = getNodes();
const currentEdges = getEdges();
const selectedNodes = currentNodes.filter(n => n.selected);
if (selectedNodes.length === 0) return;

const sceneSourceNode =
currentNodes.find(n => n.type === 'sceneReview' && n.data.result?.type === 'sceneList' && n.data.result.scenes?.length > 0) ||
currentNodes.find(n => n.type === 'scenePlanner' && n.data.result?.type === 'sceneList' && n.data.result.scenes?.length > 0);

if (!sceneSourceNode) {
setFlowStatus({ message: 'KHÔNG TÌM THẤY NODE PHÂN TÍCH CẢNH/DUYỆT PHÂN CẢNH NÀO CÓ KẾT QUẢ.', type: 'error' });
setTimeout(() => setFlowStatus(null), 3500);
return;
}
const scenes = sceneSourceNode.data.result.scenes as any[];

setUndoStack(prev => [...prev, { nodes: currentNodes, edges: currentEdges }]);

const { newNodes, newEdges } = computeFanOut(selectedNodes, currentEdges, scenes, Date.now());
const selectedIds = new Set(selectedNodes.map(n => n.id));

setNodes(nds => nds.map(n => selectedIds.has(n.id) ? { ...n, selected: false } : n).concat(newNodes));
setEdges(eds => eds.concat(newEdges));

setFlowStatus({ message: `ĐÃ NHÂN BẢN THÀNH ${scenes.length} BẢN THEO CẢNH TỪ "${sceneSourceNode.data.label || sceneSourceNode.id}".`, type: 'success' });
setTimeout(() => setFlowStatus(null), 4000);
}, [getNodes, getEdges, setNodes, setEdges]);

const handleBatchConfirm = useCallback(async (imgPrompts: string[], vidPrompts: string[], settings: any, refs: MediaAsset[]) => {
setIsBatchCombinedModalOpen(false);
setFlowStatus({ message: 'ĐANG KHỞI TẠO WORKFLOW...', type: 'info' });
setUndoStack(prev => [...prev, { nodes: getNodes(), edges: getEdges() }]);

const newNodes: Node[] = [];
const newEdges: Edge[] = [];
const viewport = getViewport();
const startX = (viewport.x * -1) + 100;
const startY = (viewport.y * -1) + 100;

const refNodeIds: string[] = [];
for (let i = 0; i < refs.length; i++) {
const ref = refs[i];
const id = `mediaSource_batch_ref_${Date.now()}_${i}`;
const node: Node = {
id, type: 'mediaSource',
position: { x: startX, y: startY + (i * 260) },
data: {
label: `Ref #${i + 1}`,
media: ref,
isBatch: true, isLoading: false, statusText: '', isFinalized: false
}
};
newNodes.push(node);
refNodeIds.push(id);
}

const maxCount = Math.max(imgPrompts.length, vidPrompts.length);
const genStartX = startX + (refs.length > 0 ? 320 : 0);

for (let i = 0; i < maxCount; i++) {
const rowY = startY + (i * 480);
let lastGenNodeId = '';

if (imgPrompts[i]) {
const imgId = `imageGen_batch_${Date.now()}_${i}`;
const imgNode: Node = {
id: imgId, type: 'imageGen',
position: { x: genStartX, y: rowY },
data: {
label: `Ảnh ${i + 1}`, model: settings.imageModel, aspectRatio: settings.imageAspectRatio,
resolution: settings.imageResolution, localPrompt: imgPrompts[i],
isLoading: false, statusText: '', result: null, isFinalized: false, isBatch: true, isPaused: false
}
};
newNodes.push(imgNode);
lastGenNodeId = imgId;

refNodeIds.forEach((refId, rIdx) => {
newEdges.push({
id: `edge_batch_ref_${refId}_to_${imgId}_${rIdx}`, source: refId, target: imgId, targetHandle: 'media-in',
style: { stroke: '#F1641E', strokeWidth: 3 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#F1641E' }
});
});
}

if (vidPrompts[i]) {
const vidId = `videoGen_batch_${Date.now()}_${i}`;
const vidNode: Node = {
id: vidId, type: 'videoGen',
position: { x: genStartX + 320, y: rowY },
data: {
label: `Video ${i + 1}`, model: settings.videoModel, aspectRatio: settings.videoAspectRatio,
resolution: settings.videoResolution, duration: settings.duration, videoMode: settings.videoMode,
voiceOverEnabled: settings.voiceOverEnabled, voiceOverVoice: settings.voiceOverVoice,
localPrompt: vidPrompts[i],
isLoading: false, statusText: '', result: null, isFinalized: false, isBatch: true, isPaused: false
}
};
newNodes.push(vidNode);

if (lastGenNodeId) {
newEdges.push({
id: `edge_batch_img_${lastGenNodeId}_to_${vidId}`, source: lastGenNodeId, target: vidId, targetHandle: 'media-in',
style: { stroke: '#F1641E', strokeWidth: 3 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#F1641E' }
});
} else {
refNodeIds.forEach((refId, rIdx) => {
newEdges.push({
id: `edge_batch_ref_${refId}_to_${vidId}_${rIdx}`, source: refId, target: vidId, targetHandle: 'media-in',
style: { stroke: '#F1641E', strokeWidth: 3 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#F1641E' }
});
});
}
}
}

setNodes(nds => nds.concat(newNodes));
setEdges(eds => eds.concat(newEdges));
setFlowStatus({ message: `ĐÃ KHỞI TẠO THÀNH CÔNG ${newNodes.length} NODES`, type: 'success' });
setTimeout(() => setFlowStatus(null), 3000);
}, [setNodes, setEdges, getNodes, getEdges, getViewport]);

const getDescendants = useCallback((nodeId: string, allNodes: Node[], allEdges: Edge[], visited = new Set<string>()): string[] => {
if (visited.has(nodeId)) return [];
visited.add(nodeId);
const childEdges = allEdges.filter(e => e.source === nodeId);
let descendants: string[] = [];
for (const edge of childEdges) {
const child = allNodes.find(n => n.id === edge.target);
if (child) descendants = [...descendants, child.id, ...getDescendants(child.id, allNodes, allEdges, visited)];
}
return descendants;
}, []);

const getAncestors = useCallback((nodeId: string, allNodes: Node[], allEdges: Edge[], visited = new Set<string>()): string[] => {
if (visited.has(nodeId)) return [];
visited.add(nodeId);
const parentEdges = allEdges.filter(e => e.target === nodeId);
let ancestors: string[] = [];
for (const edge of parentEdges) {
const parent = allNodes.find(n => n.id === edge.source);
if (parent) ancestors = [...ancestors, ...getAncestors(parent.id, allNodes, allEdges, visited), parent.id];
}
return ancestors;
}, []);

const handleDownloadNode = useCallback(async (nodeId: string) => {
const node = getNodes().find(n => n.id === nodeId);
if (!node || !node.data.result) return;

const index = getNodes().filter(n => n.type === node.type).indexOf(node);
const filename = getNodeFileName(node, index, filenamePrefix);

try {
if (node.data.result.type === 'imageSet') {
const zip = new JSZip();
for (let i = 0; i < node.data.result.images.length; i++) {
const img = node.data.result.images[i];
const base64 = await readAssetAsBase64(img.path);
zip.file(`${filename.replace(/\.[^.]+$/, '')}_${i + 1}.${img.mimeType?.includes('png') ? 'png' : 'jpg'}`, base64, { base64: true });
}
const content = await zip.generateAsync({ type: 'uint8array' });
const path = await saveDialog({ defaultPath: filename.replace(/\.[^.]+$/, '.zip'), filters: [{ name: 'ZIP', extensions: ['zip'] }] });
if (!path) return;
await writeFile(path, content);
return;
}

const path = await saveDialog({ defaultPath: filename });
if (!path) return;
if (node.data.result.type === 'text') {
await writeFile(path, new TextEncoder().encode(node.data.result.text));
return;
}
if (node.data.result.type === 'sceneList') {
await writeFile(path, new TextEncoder().encode(JSON.stringify(node.data.result, null, 2)));
return;
}
const base64 = await readAssetAsBase64(node.data.result.path);
const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
await writeFile(path, bytes);
} catch (err) {
console.error('Download failed:', err);
}
}, [getNodes, filenamePrefix]);

const handleVectorizeNode = useCallback(async (nodeId: string) => {
const node = getNodes().find(n => n.id === nodeId);
const imagePath: string | undefined = node?.data.result?.path || node?.data.media?.path;
if (!node || !imagePath) return;

setFlowStatus({ message: 'ĐANG VECTOR HOÁ...', type: 'info' });
try {
const svg = await invoke<string>('vectorize_image_to_svg', { path: imagePath });
const index = getNodes().filter(n => n.type === node.type).indexOf(node);
const filename = `${filenamePrefix}_SVG_${index + 1}_${(node.data.label || 'ASSET').replace(/[^a-z0-9]/gi, '_').toUpperCase()}.svg`;

const savePath = await saveDialog({ defaultPath: filename, filters: [{ name: 'SVG', extensions: ['svg'] }] });
if (!savePath) { setFlowStatus(null); return; }
await writeFile(savePath, new TextEncoder().encode(svg));
setFlowStatus({ message: 'ĐÃ VECTOR HOÁ THÀNH CÔNG', type: 'success' });
} catch (err: any) {
console.error('Vectorize failed:', err);
setFlowStatus({ message: `LỖI VECTOR HOÁ: ${err?.message || err}`, type: 'error' });
} finally {
setTimeout(() => setFlowStatus(null), 3000);
}
}, [getNodes, filenamePrefix]);

const runNodeLogic = async (nodeId: string, nodesSnapshot?: Node[], edgesSnapshot?: Edge[]) => {
const currentNodes = nodesSnapshot || getNodes();
const currentEdges = edgesSnapshot || getEdges();
const node = currentNodes.find(n => n.id === nodeId);
if (!node) return;

const incomingEdges = currentEdges.filter(e => e.target === nodeId);
const sourceImages: MediaAsset[] = [];
const sourceVideos: MediaAsset[] = [];
const sourceAudios: MediaAsset[] = [];
const sourceTexts: string[] = [];
const characterGroups: { name?: string; images: MediaAsset[] }[] = [];
let positiveStyle = '';
let negativeStyle = '';

for (const edge of incomingEdges) {
const src = currentNodes.find(n => n.id === edge.source);
if (!src) continue;

if (edge.targetHandle === 'media-in') {
const mediaData: any = src.data.result || src.data.media;
if (mediaData) {
if (mediaData.type === 'image') sourceImages.push(mediaData);
else if (mediaData.type === 'video') sourceVideos.push(mediaData);
else if (mediaData.type === 'audio') sourceAudios.push(mediaData);
else if (mediaData.type === 'imageSet') sourceImages.push(...mediaData.images);
}
} else if (edge.targetHandle === 'style-in') {
if (src.type === 'styleNode') {
if (src.data.positivePrompt) positiveStyle += (positiveStyle ? ', ' : '') + src.data.positivePrompt;
if (src.data.negativePrompt) negativeStyle += (negativeStyle ? ', ' : '') + src.data.negativePrompt;
}
} else if (edge.targetHandle === 'text-in') {
if (src.data.result?.type === 'text' && src.data.result.text) sourceTexts.push(src.data.result.text);
} else if (edge.targetHandle?.startsWith('character-in-')) {
const mediaData: any = src.data.result || src.data.media;
if (mediaData?.type === 'imageSet') {
characterGroups.push({ name: mediaData.characterName, images: mediaData.images });
} else if (mediaData?.type === 'image') {
characterGroups.push({ name: undefined, images: [mediaData] });
}
}
}

setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, isLoading: true, statusText: 'Đang xử lý...', isFinalized: false } } : n));

try {
const apiKey = appSettingsRef.current.geminiApiKey ?? '';
const imageProvider = new GeminiImageProvider(apiKey);
const videoProvider = new GeminiVideoProvider(apiKey);
const omniFlashProvider = new GeminiOmniFlashProvider(apiKey);
const textProvider = new GeminiTextProvider(apiKey);

const basePrompt = node.data.localPrompt || 'A cinematic masterpiece';

// Nhân vật nhất quán: ảnh từng nhân vật (đã gộp qua các chân character-in-N)
// nối thêm vào cuối danh sách ảnh tham chiếu chung, kèm 1 đoạn ghi chú trong
// prompt để Gemini biết đâu là ảnh của ai — bản thân API không tự phân biệt
// được chỉ vì ảnh tới từ chân khác nhau, phải nói rõ bằng chữ.
let characterNote = '';
if (characterGroups.length > 0) {
let cursor = sourceImages.length;
const parts: string[] = [];
characterGroups.forEach((g, i) => {
const from = cursor + 1;
const to = cursor + g.images.length;
const label = g.name ? `Nhân vật ${i + 1} (${g.name})` : `Nhân vật ${i + 1}`;
parts.push(`${label} = ảnh tham chiếu ${from}${to > from ? `-${to}` : ''}`);
cursor = to;
});
characterNote = `\n\nGhi chú tham chiếu nhân vật (giữ đúng ngoại hình từng người theo đúng ảnh tương ứng): ${parts.join('; ')}.`;
}

const finalPrompt = (positiveStyle ? `${basePrompt}, ${positiveStyle}` : basePrompt) + characterNote;

const allReferenceAssets = [...sourceImages, ...characterGroups.flatMap(g => g.images)];
const referenceImages = allReferenceAssets.length
? await Promise.all(allReferenceAssets.slice(0, 16).map(async (m) => ({
base64: await readAssetAsBase64(m.path),
mimeType: m.mimeType,
})))
: undefined;

if (node.type === 'textGen') {
const text = await textProvider.generateText({
prompt: finalPrompt,
negativePrompt: negativeStyle || undefined,
referenceImages,
model: resolveTextModelId(node.data.model),
});
setNodes(nds => nds.map(n => n.id === nodeId ? {
...n,
data: {
...n.data, isLoading: false, statusText: 'Hoàn tất', isFinalized: true,
lastRunHash: getNodeStateHash(node, currentEdges),
result: { type: 'text', text }
}
} : n));
return;
}

if (node.type === 'stt') {
const sourceMedia = sourceVideos[0] || sourceAudios[0];
if (!sourceMedia) throw new Error('Chưa có video/audio nào nối vào node này.');
const mediaBase64 = await readAssetAsBase64(sourceMedia.path);
const text = await textProvider.transcribeMedia({
mediaBase64,
mimeType: sourceMedia.mimeType,
model: resolveTextModelId(node.data.model),
instruction: node.data.localPrompt || undefined,
});
setNodes(nds => nds.map(n => n.id === nodeId ? {
...n,
data: {
...n.data, isLoading: false, statusText: 'Hoàn tất', isFinalized: true,
lastRunHash: getNodeStateHash(node, currentEdges),
result: { type: 'text', text }
}
} : n));
return;
}

if (node.type === 'vbee') {
const scriptText = sourceTexts.join('\n\n');
if (!scriptText.trim()) throw new Error('Chưa có text nào nối vào node này.');

const vbeeProvider = new VbeeProvider(appSettingsRef.current.vbeeAppId ?? '', appSettingsRef.current.vbeeToken ?? '');
const synthResult = await vbeeProvider.synthesizeScript({
text: scriptText,
voiceCode: resolveVbeeVoiceCode(node.data.voiceLabel),
speed: node.data.speed ?? 0.95,
sampleRate: node.data.sampleRate ?? 48000,
gapSeconds: node.data.gapSeconds ?? 0.35,
onProgress: ({ current, total }) => {
setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, statusText: `Đang đọc câu ${current}/${total}...` } } : n));
},
});

const asset = await saveAssetFromBytes(synthResult.audioBytes, 'audio/wav');
setNodes(nds => nds.map(n => n.id === nodeId ? {
...n,
data: {
...n.data, isLoading: false, statusText: 'Hoàn tất', isFinalized: true,
lastRunHash: getNodeStateHash(node, currentEdges),
result: {
...asset, type: 'audio',
durationSeconds: synthResult.durationSeconds,
sampleRate: synthResult.sampleRate,
timingSentences: synthResult.sentences.map(s => ({ index: s.index, text: s.text, start: s.start, end: s.end })),
}
}
} : n));
return;
}

if (node.type === 'audioMaster') {
const sourceAudio = sourceAudios[0];
if (!sourceAudio) throw new Error('Chưa có audio nào nối vào node này.');

setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, statusText: 'Đang chuẩn hoá âm lượng...' } } : n));

const tempDir = await appDataDir();
const tempOutputPath = await join(tempDir, `_master_tmp_${Date.now()}.wav`);
let finalBytes: Uint8Array;
let masteredNote: string | undefined;
const targetLufs = node.data.targetLufs ?? -14.0;
try {
const masterResult = await invoke<{ mastered: boolean; note?: string }>('master_audio', {
inputPath: sourceAudio.path, outputPath: tempOutputPath, targetLufs, sampleRate: sourceAudio.sampleRate ?? 44100,
});
if (masterResult.mastered) {
finalBytes = await readFile(tempOutputPath);
} else {
finalBytes = await readFile(sourceAudio.path);
masteredNote = masterResult.note ?? 'Chưa cài ffmpeg trên máy — đang dùng bản thô, chưa chuẩn hoá âm lượng.';
}
} catch (e: any) {
finalBytes = await readFile(sourceAudio.path);
masteredNote = `Không chạy được bước làm đẹp giọng đọc (${e?.message || e}) — đang dùng bản thô.`;
} finally {
await deleteAsset(tempOutputPath).catch(() => {});
}

const asset = await saveAssetFromBytes(finalBytes, 'audio/wav');
setNodes(nds => nds.map(n => n.id === nodeId ? {
...n,
data: {
...n.data, isLoading: false, statusText: 'Hoàn tất', isFinalized: true,
lastRunHash: getNodeStateHash(node, currentEdges),
result: {
...asset, type: 'audio',
durationSeconds: sourceAudio.durationSeconds,
sampleRate: sourceAudio.sampleRate,
timingSentences: sourceAudio.timingSentences,
mastered: !masteredNote,
masteredNote,
}
}
} : n));
return;
}

if (node.type === 'scenePlanner') {
const sourceVideo = sourceVideos[0];
const sourceAudio = sourceAudios[0];
if (!sourceVideo) throw new Error('Chưa có video gốc nào nối vào node này.');
if (!sourceAudio) throw new Error('Chưa có audio (từ Vbee/Làm Đẹp Âm Thanh) nào nối vào node này.');
if (!sourceAudio.timingSentences?.length) throw new Error('Audio nối vào chưa có mốc thời gian từng câu (timingSentences) — phải là audio đi thẳng hoặc gián tiếp từ node Vbee TTS.');

setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, statusText: 'Đang chia phân cảnh theo lời thoại...' } } : n));

const skeleton = buildScenesSkeleton(sourceAudio.timingSentences, sourceAudio.durationSeconds ?? sourceAudio.timingSentences[sourceAudio.timingSentences.length - 1].end, node.data.targetSceneSeconds ?? 6.0);
if (skeleton.length === 0) throw new Error('Không chia được phân cảnh nào từ audio đầu vào.');

setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, statusText: `Đang phân tích hình ảnh cho ${skeleton.length} cảnh...` } } : n));

const videoBase64 = await readAssetAsBase64(sourceVideo.path);
const filled = await textProvider.fillSceneDetails({
videoBase64,
videoMimeType: sourceVideo.mimeType,
scenes: skeleton.map(s => ({ id: s.id, start: s.start, end: s.end, vo: s.vo })),
style: positiveStyle || undefined,
model: resolveTextModelId(node.data.model),
});

const scenes = skeleton.map(s => ({ ...s, ...(filled[s.id] ?? {}) }));

setNodes(nds => nds.map(n => n.id === nodeId ? {
...n,
data: {
...n.data, isLoading: false, statusText: 'Hoàn tất', isFinalized: true,
lastRunHash: getNodeStateHash(node, currentEdges),
result: { type: 'sceneList', scenes, style: positiveStyle || undefined }
}
} : n));
return;
}

if (node.type === 'character') {
const frontal = sourceImages[0];
if (!frontal) throw new Error('Chưa có ảnh trực diện nào nối vào node này.');
const frontalBase64 = await readAssetAsBase64(frontal.path);
const images: MediaAsset[] = [frontal];

for (let i = 0; i < CHARACTER_ANGLES.length; i++) {
const angle = CHARACTER_ANGLES[i];
setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, statusText: `Đang tạo góc ${angle.label} (${i + 1}/${CHARACTER_ANGLES.length})...` } } : n));
const angleResult = await imageProvider.generateImage({
prompt: angle.prompt,
referenceImages: [{ base64: frontalBase64, mimeType: frontal.mimeType }],
aspectRatio: (node.data.aspectRatio || '3:4') as any,
model: resolveImageModelId(node.data.model),
});
const asset = await saveAssetFromBase64(angleResult.base64, angleResult.mimeType);
images.push({ ...asset, type: 'image' });
}

setNodes(nds => nds.map(n => n.id === nodeId ? {
...n,
data: {
...n.data, isLoading: false, statusText: 'Hoàn tất', isFinalized: true,
lastRunHash: getNodeStateHash(node, currentEdges),
result: { type: 'imageSet', images, characterName: node.data.characterName || undefined },
}
} : n));
return;
}

let genResult: { base64: string; mimeType: string };
let resultType: 'image' | 'video';

if (node.type === 'imageGen') {
resultType = 'image';
genResult = await imageProvider.generateImage({
prompt: finalPrompt,
negativePrompt: negativeStyle || undefined,
referenceImages,
aspectRatio: node.data.aspectRatio,
model: resolveImageModelId(node.data.model),
});
} else if (node.type === 'videoGen') {
resultType = 'video';
const isOmniFlash = node.data.model === 'Omni Flash';

let firstFrame, lastFrame;
if (node.data.videoMode === 'frame') {
if (sourceImages.length > 2) throw new Error('CHẾ ĐỘ KHUNG HÌNH CHỈ HỖ TRỢ TỐI ĐA 2 ẢNH ĐẦU VÀO.');
if (referenceImages?.[0]) firstFrame = referenceImages[0];
if (referenceImages?.[1]) lastFrame = referenceImages[1];
}

const videoParams = {
prompt: finalPrompt,
negativePrompt: negativeStyle || undefined,
model: resolveVideoModelId(node.data.model),
aspectRatio: node.data.aspectRatio,
resolution: node.data.resolution,
firstFrame,
lastFrame,
referenceImages: node.data.videoMode === 'reference' ? referenceImages?.slice(0, 5) : undefined,
};

// Omni Flash: người dùng chỉnh được 4-10s (Google Flow cho phép). Các model
// Veo còn lại: luôn cố định 8s — API không nhận giá trị nào khác.
genResult = isOmniFlash
? await omniFlashProvider.generateVideo({ ...videoParams, durationSeconds: Math.min(Math.max(node.data.duration ?? 8, 4), 10) })
: await videoProvider.generateVideo({ ...videoParams, durationSeconds: 8 });
} else {
return;
}

const asset = await saveAssetFromBase64(genResult.base64, genResult.mimeType);

setNodes(nds => nds.map(n => n.id === nodeId ? {
...n,
data: {
...n.data, isLoading: false, statusText: 'Hoàn tất', isFinalized: true,
lastRunHash: getNodeStateHash(node, currentEdges),
result: { ...asset, type: resultType, resolution: n.data.resolution }
}
} : n));
} catch (err: any) {
setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, isLoading: false, statusText: 'Lỗi' } } : n));
throw err;
}
};

const executeWorkflow = useCallback(async (nodeIdsToRun: string[]) => {
if (runningChain || activeJobsRef.current > 0 || nodeIdsToRun.length === 0) return;

setRunningChain(true);
stopFlagRef.current = false;
setIsStopping(false);
setFlowStatus({ message: 'ĐANG XỬ LÝ...', type: 'info' });

const remainingNodes = new Set(nodeIdsToRun);
const completedNodes = new Set<string>();
const processingNodes = new Set<string>();
let chainFailed = false;

const isNodeReady = (nodeId: string, currentEdges: Edge[]) => {
const parentEdges = currentEdges.filter(e => e.target === nodeId);
for (const edge of parentEdges) {
if (nodeIdsToRun.includes(edge.source) && !completedNodes.has(edge.source)) return false;
}
return true;
};

while ((remainingNodes.size > 0 || activeJobsRef.current > 0) && !stopFlagRef.current && !chainFailed) {
const currentNodes = getNodes();
const currentEdges = getEdges();

const readyNodes = Array.from(remainingNodes).filter(id => {
const node = currentNodes.find(n => n.id === id);
if (!node) return false;
if (node.type === 'mediaSource' || node.type === 'styleNode' || node.type === 'textReview' || node.type === 'sceneReview') {
completedNodes.add(id);
remainingNodes.delete(id);
return false;
}
return isNodeReady(id, currentEdges) && !processingNodes.has(id);
});

for (const nodeId of readyNodes) {
if (activeJobsRef.current >= concurrency || stopFlagRef.current || chainFailed) break;

const node = currentNodes.find(n => n.id === nodeId);
if (!node) { remainingNodes.delete(nodeId); continue; }

if (!isNodeDirty(node, currentEdges)) {
remainingNodes.delete(nodeId);
completedNodes.add(nodeId);
addLog(nodeId, node.data.label || nodeId, 'success', 'Bỏ qua (Dữ liệu đã sẵn sàng).');
continue;
}

remainingNodes.delete(nodeId);
processingNodes.add(nodeId);
activeJobsRef.current++;
setActiveJobsTick(t => t + 1);

addLog(nodeId, node.data.label || nodeId, 'running', 'Bắt đầu xử lý...');

(async () => {
try {
await runNodeLogic(nodeId, getNodes(), getEdges());
completedNodes.add(nodeId);
addLog(nodeId, node.data.label || nodeId, 'success', 'Hoàn tất thành công.');
} catch (e: any) {
chainFailed = true;
stopFlagRef.current = true;
// Lỗi từ Tauri (VD bị chặn bởi capability scope của plugin http) nhiều khi
// là string thuần chứ không phải Error có .message — trước đây rơi vào
// 'Lỗi xử lý.' chung chung, không biết đường nào mà sửa.
const errText = typeof e === 'string' ? e : (e?.message || JSON.stringify(e) || 'Lỗi xử lý.');
addLog(nodeId, node.data.label || nodeId, 'error', errText);
} finally {
activeJobsRef.current--;
setActiveJobsTick(t => t + 1);
processingNodes.delete(nodeId);
}
})();
}
await new Promise(r => setTimeout(r, 400));
}

setRunningChain(false);
setIsStopping(false);
setFlowStatus({
message: chainFailed ? 'LỖI WORKFLOW.' : (stopFlagRef.current ? 'ĐÃ DỪNG.' : 'HOÀN TẤT.'),
type: chainFailed ? 'error' : (stopFlagRef.current ? 'warning' : 'success')
});
setTimeout(() => setFlowStatus(null), 3000);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [getNodes, getEdges, concurrency, runningChain, isNodeDirty]);

const addLog = useCallback((nodeId: string, nodeName: string, status: LogEntry['status'], message: string) => {
setExecutionLogs(prev => [
{ id: `log_${Date.now()}_${nodeId}`, nodeId, nodeName, status, message, timestamp: Date.now() },
...prev.slice(0, 49)
]);
}, []);

const handleExecuteNode = (nodeId: string, mode: ExecutionMode = 'single') => {
const currentNodes = getNodes();
const currentEdges = getEdges();
let targetNodes: string[] = [];

if (mode === 'single') {
const ancestors = getAncestors(nodeId, currentNodes, currentEdges);
const unfinishedAncestors = ancestors.filter(id => {
const n = currentNodes.find(item => item.id === id);
return n && isNodeDirty(n, currentEdges);
});
targetNodes = [...unfinishedAncestors, nodeId];
} else {
const descendants = getDescendants(nodeId, currentNodes, currentEdges);
targetNodes = [nodeId, ...descendants];
}
executeWorkflow(targetNodes);
};

useEffect(() => {
const hEx = (e: any) => handleExecuteNode(e.detail.nodeId, e.detail.mode);
const hPrev = (e: any) => setPreviewDataState({ open: true, type: e.detail.type, src: e.detail.src, title: e.detail.title });
const hSettings = (e: any) => {
const nodeId = e.detail.nodeId;
const targetNode = getNodes().find(n => n.id === nodeId);
if (targetNode?.type === 'styleNode') {
setActiveStyleSettingsNodeId(nodeId);
setActiveSettingsNodeId(null);
} else {
setActiveSettingsNodeId(nodeId);
setActiveStyleSettingsNodeId(null);
}
setIsNodeLibraryOpen(false);
};
const hDup = (e: any) => onDuplicateNode(e.detail.nodeId);
const hDown = (e: any) => handleDownloadNode(e.detail.nodeId);
const hVec = (e: any) => handleVectorizeNode(e.detail.nodeId);
const hSceneEdit = (e: any) => {
setActiveSceneEdit({ nodeId: e.detail.nodeId, sceneId: e.detail.sceneId });
setActiveSettingsNodeId(null);
setActiveStyleSettingsNodeId(null);
setIsNodeLibraryOpen(false);
};

window.addEventListener('execute-node' as any, hEx);
window.addEventListener('open-preview' as any, hPrev);
window.addEventListener('open-node-settings' as any, hSettings);
window.addEventListener('duplicate-node' as any, hDup);
window.addEventListener('download-node' as any, hDown);
window.addEventListener('vectorize-node' as any, hVec);
window.addEventListener('open-scene-edit' as any, hSceneEdit);
return () => {
window.removeEventListener('execute-node' as any, hEx);
window.removeEventListener('open-preview' as any, hPrev);
window.removeEventListener('open-node-settings' as any, hSettings);
window.removeEventListener('duplicate-node' as any, hDup);
window.removeEventListener('download-node' as any, hDown);
window.removeEventListener('vectorize-node' as any, hVec);
window.removeEventListener('open-scene-edit' as any, hSceneEdit);
};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [getNodes, getEdges, isNodeDirty, onDuplicateNode, handleDownloadNode, handleVectorizeNode]);

const handleSaveSettings = useCallback(async (next: AppSettings) => {
setAppSettings(next);
await saveSettings(next);
}, []);

return (
<div className={`w-full h-full bg-[#070b14] flex flex-col mode-${interactionMode} text-white relative p-1 overflow-hidden`}>
<div className="absolute inset-0 pointer-events-none border border-[#F1641E]/20 z-[60]" />
<div className="absolute inset-0 pointer-events-none border-[8px] border-[#0b1019] z-[55]" />
<div className="flex-1 flex flex-col bg-[#0a0e17] overflow-hidden relative shadow-2xl">
<WorkspaceManager
workspaces={workspaces} activeId={activeWorkspaceId}
isGlobalPaused={false} onTogglePause={() => {}}
concurrency={concurrency} onChangeConcurrency={() => {}}
onRunPipeline={() => {
const currentNodes = getNodes();
const currentEdges = getEdges();
const dirty = currentNodes.filter(n => (n.type === 'imageGen' || n.type === 'videoGen' || n.type === 'textGen' || n.type === 'stt' || n.type === 'vbee' || n.type === 'audioMaster' || n.type === 'scenePlanner' || n.type === 'character') && isNodeDirty(n, currentEdges));
const ids = new Set<string>();
dirty.forEach(n => { ids.add(n.id); getDescendants(n.id, currentNodes, currentEdges).forEach(d => ids.add(d)); });
executeWorkflow(Array.from(ids));
}}
onStopPipeline={() => { stopFlagRef.current = true; setIsStopping(true); }} isStopping={isStopping} isRunning={runningChain}
flowStatus={flowStatus} onClearFlowStatus={() => setFlowStatus(null)}
onSelect={handleSelectWorkspace} onAdd={handleAddWorkspace} onDelete={handleDeleteWorkspace} onRename={handleRenameWorkspace}
onOpenLog={() => setIsLogPanelOpen(!isLogPanelOpen)}
onUndo={handleUndo}
/>
<div className="flex-1 relative overflow-hidden flex">
<div className="w-[64px] h-full bg-[#0b1019] border-r border-[#F1641E]/10 flex flex-col items-center py-3 gap-3 z-[70] shrink-0">
<button
onClick={() => { setIsNodeLibraryOpen(!isNodeLibraryOpen); setActiveSettingsNodeId(null); setActiveStyleSettingsNodeId(null); }}
className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isNodeLibraryOpen ? 'bg-[#F1641E] text-black shadow-[0_0_15px_rgba(241,100,30,0.4)]' : 'bg-[#F1641E]/10 text-[#F1641E] border border-[#F1641E]/20 hover:bg-[#F1641E]/20'}`}
>
<span className="material-symbols-outlined text-[24px]">{isNodeLibraryOpen ? 'close' : 'add'}</span>
</button>
<div className="w-8 h-[1px] bg-white/10 my-1" />
<div className="flex flex-col gap-2">
<ToolbarButton active={interactionMode === 'select'} icon="near_me" label="SELECT" onClick={() => setInteractionMode('select')} />
<ToolbarButton active={interactionMode === 'hand'} icon="pan_tool" label="PAN" onClick={() => setInteractionMode('hand')} />
</div>
<div className="w-8 h-[1px] bg-white/10 my-1" />
<button onClick={handleResetAllResults} title="Reset kết quả" className="w-9 h-9 rounded-lg flex items-center justify-center bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all text-red-400">
<span className="material-symbols-outlined text-[18px]">restart_alt</span>
</button>
<div className="mt-auto flex flex-col gap-2 mb-2">
<button onClick={handleImport} title="Nhập .bunnaflow" className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#F1641E]/10 border border-[#F1641E]/20 hover:bg-[#F1641E]/20 transition-all text-[#F1641E]">
<span className="material-symbols-outlined text-[18px]">upload</span>
</button>
<button onClick={handleExport} title="Xuất workflow đang mở (.bunnaflow)" className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#F1641E]/10 border border-[#F1641E]/20 hover:bg-[#F1641E]/20 transition-all text-[#F1641E]">
<span className="material-symbols-outlined text-[18px]">download</span>
</button>
<button onClick={handleExportAll} title="Xuất tất cả workflow (backup)" className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#F1641E]/10 border border-[#F1641E]/20 hover:bg-[#F1641E]/20 transition-all text-[#F1641E]">
<span className="material-symbols-outlined text-[18px]">backup</span>
</button>
<div className="w-8 h-[1px] bg-white/10 my-1" />
<button onClick={() => setIsSettingsOpen(!isSettingsOpen)} title="Cài đặt" className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/[0.03] border border-white/10 text-[#94a3b8] hover:text-white hover:bg-white/10 transition-all">
<span className="material-symbols-outlined text-[18px]">settings</span>
</button>
</div>
</div>
<div className="flex-1 relative bg-[#1C1C1C] flex">
{isNodeLibraryOpen && <NodeLibraryPanel onAdd={(type) => onAddManualNode(type)} onClose={() => setIsNodeLibraryOpen(false)} />}
{activeSettingsNodeId && <NodeSettingsPanel nodeId={activeSettingsNodeId} nodes={nodes} onUpdateData={(id, key, val) => {
setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [key]: val } } : n));
if (key === 'characterCount') {
// Giảm số nhân vật thì xoá luôn dây đang nối vào các chân bị mất, không để treo lơ lửng.
setEdges(eds => eds.filter(e => {
if (e.target !== id || !e.targetHandle?.startsWith('character-in-')) return true;
const idx = parseInt(e.targetHandle.replace('character-in-', ''), 10);
return idx < val;
}));
}
}} onClose={() => setActiveSettingsNodeId(null)} />}
{activeStyleSettingsNodeId && <StyleSettingsModal isOpen={!!activeStyleSettingsNodeId} nodeId={activeStyleSettingsNodeId} nodes={nodes} onUpdate={(id, key, val) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [key]: val } } : n))} onClose={() => setActiveStyleSettingsNodeId(null)} />}
{activeSceneEdit && <SceneEditPanel
nodeId={activeSceneEdit.nodeId}
sceneId={activeSceneEdit.sceneId}
nodes={nodes}
onUpdateScene={(nodeId, sceneId, updated) => setNodes(nds => nds.map(n => {
if (n.id !== nodeId) return n;
const scenes = (n.data.editedScenes ?? []).map((s: any) => s.id === sceneId ? updated : s);
return { ...n, data: { ...n.data, editedScenes: scenes, result: { type: 'sceneList', scenes } } };
}))}
onClose={() => setActiveSceneEdit(null)}
/>}
{isLogPanelOpen && <ExecutionLogPanel logs={executionLogs} onClear={() => setExecutionLogs([])} onClose={() => setIsLogPanelOpen(false)} />}
{isSettingsOpen && <SettingsPanel settings={appSettings} onSave={handleSaveSettings} onClose={() => setIsSettingsOpen(false)} filenamePrefix={filenamePrefix} onChangePrefix={setFilenamePrefix} />}
<ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
onConnect={handleConnect}
onPaneContextMenu={(e) => { e.preventDefault(); const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY }); setMenuState({ x: e.clientX, y: e.clientY, flowPos, visible: true }); }}
onPaneClick={() => { setMenuState(null); setIsNodeLibraryOpen(false); setActiveSettingsNodeId(null); setActiveStyleSettingsNodeId(null); }}
onNodesDelete={onNodesDelete} onEdgesDelete={onEdgesDelete}
nodeTypes={NODE_TYPES} edgeTypes={EDGE_TYPES} snapToGrid snapGrid={[10, 10]}
panOnDrag={interactionMode === 'hand' ? true : [1, 2]} selectionOnDrag={interactionMode === 'select'} selectionMode={SelectionMode.Partial} panOnScroll zoomOnScroll minZoom={0.05} maxZoom={4}
proOptions={{ hideAttribution: true }}
>
<Background variant={BackgroundVariant.Dots} gap={10} size={1} color="#333" />
<Controls showInteractive={false} position="bottom-left" />
<Panel position="bottom-right" className="m-4"><BatchExportPanel nodes={nodes} globalPrefix={filenamePrefix} /></Panel>
{nodes.some(n => n.selected) && (
<Panel position="top-center" className="m-4">
<button
onClick={handleFanOutFromSelection}
className="flex items-center gap-2 px-4 py-2.5 bg-[#F1641E] hover:bg-[#F1641E]/80 text-black rounded-xl text-[10px] font-black uppercase tracking-widest shadow-2xl transition-all active:scale-95"
title="Nhân bản các node đang chọn thành nhiều bản, mỗi bản 1 phân cảnh — điểm vào của chain sẽ tự nhận prompt riêng từng cảnh"
>
<span className="material-symbols-outlined text-[16px]">content_copy</span>
Nhân bản theo phân cảnh
</button>
</Panel>
)}
</ReactFlow>
{menuState && <ContextMenu x={menuState.x} y={menuState.y} onAddManualNode={(type) => onAddManualNode(type, menuState.flowPos)} onClose={() => setMenuState(null)} />}
{isBatchCombinedModalOpen && <BatchCombinedModal prefix={filenamePrefix} onChangePrefix={setFilenamePrefix} onConfirm={handleBatchConfirm} onCancel={() => setIsBatchCombinedModalOpen(false)} />}
{pendingImport?.kind === 'single' && (
<ImportChoiceModal
currentWorkspaceName={workspaces.find(w => w.id === activeWorkspaceId)?.name || 'Workflow hiện tại'}
onReplace={handleImportReplace}
onCreateNew={handleImportCreateNew}
onCancel={handleImportCancel}
/>
)}
{pendingImport?.kind === 'all' && (
<ImportAllChoiceModal
fileWorkspaceCount={pendingImport.workspaces.length}
currentWorkspaceCount={workspaces.length}
onAddAll={handleImportCreateNew}
onReplaceAll={handleImportAllReplace}
onCancel={handleImportCancel}
/>
)}
{previewDataState && <QuickPreviewModal open={previewDataState.open} type={previewDataState.type} src={previewDataState.src} title={previewDataState.title} onClose={() => setPreviewDataState(null)} />}
</div>
</div>
</div>
</div>
);
};

const ToolbarButton: React.FC<{ active: boolean, icon: string, label: string, onClick: () => void }> = ({ active, icon, label, onClick }) => (
<button onClick={onClick} className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center transition-all ${active ? 'bg-[#F1641E] text-black' : 'text-white/30 hover:bg-white/5'}`}>
<span className="material-symbols-outlined text-[18px]">{icon}</span>
<span className="text-[6px] font-black mt-0.5">{label}</span>
</button>
);

// About modal nằm ở cấp NGOÀI LicenseGate — để menu "About BUNNA AI FLOW"
// vẫn hoạt động kể cả khi chưa nhập/xác thực access key (FlowApp chưa mount).
const Root: React.FC = () => {
const [isAboutOpen, setIsAboutOpen] = useState(false);

useEffect(() => {
const unlisten = listen('show-about', () => setIsAboutOpen(true));
return () => { unlisten.then(f => f()); };
}, []);

return (
<>
<LicenseGate><ReactFlowProvider><FlowApp /></ReactFlowProvider></LicenseGate>
{isAboutOpen && <AboutModal onClose={() => setIsAboutOpen(false)} />}
</>
);
};

export default Root;
