import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
Controls,
Edge,
addEdge,
Node,
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

// Custom Nodes & Components
import MediaSourceNode from './components/nodes/MediaSourceNode';
import ImageGenNode from './components/nodes/ImageGenNode';
import VideoGenNode from './components/nodes/VideoGenNode';
import StyleNode from './components/nodes/StyleNode';
import DeleteEdge from './components/nodes/DeleteEdge';
import WorkspaceManager from './components/WorkspaceManager';
import ContextMenu from './components/ContextMenu';
import NodeSettingsPanel from './components/NodeSettingsPanel';
import StyleSettingsModal from './components/StyleSettingsModal';
import NodeLibraryPanel from './components/NodeLibraryPanel';
import ExecutionLogPanel from './components/ExecutionLogPanel';
import BatchExportPanel from './components/BatchExportPanel';
import BatchCombinedModal from './components/BatchCombinedModal';
import SettingsPanel from './components/SettingsPanel';
import { QuickPreviewModal } from './components/UI';

import type { Workspace, LogEntry, MediaAsset } from './types';
import { loadSettings, saveSettings, type AppSettings } from './lib/settings';
import { loadWorkspaceState, saveWorkspaceState } from './lib/workspaceStore';
import { exportWorkspaces, importWorkspaces } from './lib/exportImport';
import { saveAssetFromBase64, readAssetAsBase64 } from './lib/assets';
import { GeminiImageProvider } from './lib/providers/geminiImageProvider';
import { GeminiVideoProvider } from './lib/providers/geminiVideoProvider';
import { resolveImageModelId, resolveVideoModelId } from './lib/models';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

export const getNodeFileName = (node: Node, index: number, prefix: string = 'BUNNA_FLOW') => {
const typeCode = node.type === 'imageGen' ? 'IMG' : (node.type === 'videoGen' ? 'VID' : 'RES');
const extension = node.data.result?.type === 'video' ? 'mp4' : 'jpg';
const label = (node.data.label || 'ASSET').replace(/[^a-z0-9]/gi, '_').toUpperCase();
return `${prefix}_${typeCode}_${index + 1}_${label}.${extension}`;
};

const NODE_TYPES = {
mediaSource: MediaSourceNode,
imageGen: ImageGenNode,
videoGen: VideoGenNode,
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

const [filenamePrefix, setFilenamePrefix] = useState('BUNNA_FLOW');
const [concurrency] = useState(2);
const [isStopping, setIsStopping] = useState(false);

const [flowStatus, setFlowStatus] = useState<{ message: string, type: 'info' | 'error' | 'success' | 'warning', canUndo?: boolean } | null>(null);
const [runningChain, setRunningChain] = useState(false);

const [activeSettingsNodeId, setActiveSettingsNodeId] = useState<string | null>(null);
const [activeStyleSettingsNodeId, setActiveStyleSettingsNodeId] = useState<string | null>(null);

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
if (node.type === 'imageGen' || node.type === 'videoGen') {
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
const fullWorkspaces = workspaces.map(ws => ws.id === activeWorkspaceId ? {
...ws, nodes, edges, viewport: getViewport()
} : ws);
try {
const didSave = await exportWorkspaces(fullWorkspaces, activeWorkspaceId);
if (didSave) {
setFlowStatus({ message: 'ĐÃ XUẤT FILE .BUNNAFLOW', type: 'success' });
setTimeout(() => setFlowStatus(null), 2500);
}
} catch (err) {
console.error('Export failed:', err);
setFlowStatus({ message: 'LỖI KHI XUẤT FILE', type: 'error' });
setTimeout(() => setFlowStatus(null), 2500);
}
}, [workspaces, activeWorkspaceId, nodes, edges, getViewport]);

const handleImport = useCallback(async () => {
try {
const result = await importWorkspaces();
if (!result) return;
setWorkspaces(result.workspaces);
const first = result.workspaces.find(w => w.id === result.activeWorkspaceId) ?? result.workspaces[0];
setActiveWorkspaceId(first.id);
setNodes(first.nodes || []);
setEdges(first.edges || []);
if (first.viewport) setViewport(first.viewport);
setFlowStatus({ message: 'NHẬP FILE THÀNH CÔNG', type: 'success' });
} catch (err) {
console.error('Import failed:', err);
setFlowStatus({ message: 'LỖI ĐỊNH DẠNG HOẶC FILE HỎNG', type: 'error' });
} finally {
setTimeout(() => setFlowStatus(null), 3000);
}
}, [setNodes, setEdges, setViewport]);

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

return [node.data.model, node.data.localPrompt, node.data.aspectRatio, node.data.resolution, node.data.duration, incomingMediaIds, styleStrings].join('::');
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
case 'videoGen': newNode = { id, type, position: finalPos, data: { ...commonData, label: 'Video AI', model: 'Omni Flash', aspectRatio: '16:9', resolution: '720p', duration: 10, videoMode: 'frame', voiceOverEnabled: false, voiceOverVoice: 'Puck — Upbeat', localPrompt: '' } }; break;
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
const path = await saveDialog({ defaultPath: filename });
if (!path) return;
const base64 = await readAssetAsBase64(node.data.result.path);
const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
await writeFile(path, bytes);
} catch (err) {
console.error('Download failed:', err);
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
let positiveStyle = '';
let negativeStyle = '';

for (const edge of incomingEdges) {
const src = currentNodes.find(n => n.id === edge.source);
if (!src) continue;

if (edge.targetHandle === 'media-in') {
const mediaData: MediaAsset | undefined = src.data.result || src.data.media;
if (mediaData) {
if (mediaData.type === 'image') sourceImages.push(mediaData);
else if (mediaData.type === 'video') sourceVideos.push(mediaData);
}
} else if (edge.targetHandle === 'style-in') {
if (src.type === 'styleNode') {
if (src.data.positivePrompt) positiveStyle += (positiveStyle ? ', ' : '') + src.data.positivePrompt;
if (src.data.negativePrompt) negativeStyle += (negativeStyle ? ', ' : '') + src.data.negativePrompt;
}
}
}

setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, isLoading: true, statusText: 'Đang xử lý...', isFinalized: false } } : n));

try {
const apiKey = appSettingsRef.current.geminiApiKey ?? '';
const imageProvider = new GeminiImageProvider(apiKey);
const videoProvider = new GeminiVideoProvider(apiKey);

const basePrompt = node.data.localPrompt || 'A cinematic masterpiece';
const finalPrompt = positiveStyle ? `${basePrompt}, ${positiveStyle}` : basePrompt;

const referenceImages = sourceImages.length
? await Promise.all(sourceImages.slice(0, 10).map(async (m) => ({
base64: await readAssetAsBase64(m.path),
mimeType: m.mimeType,
})))
: undefined;

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
const finalDuration = node.data.model === 'Omni Flash' ? node.data.duration : 8;

let firstFrame, lastFrame;
if (node.data.videoMode === 'frame') {
if (sourceImages.length > 2) throw new Error('CHẾ ĐỘ KHUNG HÌNH CHỈ HỖ TRỢ TỐI ĐA 2 ẢNH ĐẦU VÀO.');
if (referenceImages?.[0]) firstFrame = referenceImages[0];
if (referenceImages?.[1]) lastFrame = referenceImages[1];
}

genResult = await videoProvider.generateVideo({
prompt: finalPrompt,
negativePrompt: negativeStyle || undefined,
model: resolveVideoModelId(node.data.model),
aspectRatio: node.data.aspectRatio,
durationSeconds: finalDuration,
firstFrame,
lastFrame,
referenceImages: node.data.videoMode === 'reference' ? referenceImages?.slice(0, 5) : undefined,
});
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
if (node.type === 'mediaSource' || node.type === 'styleNode') {
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
addLog(nodeId, node.data.label || nodeId, 'error', e?.message || 'Lỗi xử lý.');
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

window.addEventListener('execute-node' as any, hEx);
window.addEventListener('open-preview' as any, hPrev);
window.addEventListener('open-node-settings' as any, hSettings);
window.addEventListener('duplicate-node' as any, hDup);
window.addEventListener('download-node' as any, hDown);
return () => {
window.removeEventListener('execute-node' as any, hEx);
window.removeEventListener('open-preview' as any, hPrev);
window.removeEventListener('open-node-settings' as any, hSettings);
window.removeEventListener('duplicate-node' as any, hDup);
window.removeEventListener('download-node' as any, hDown);
};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [getNodes, getEdges, isNodeDirty, onDuplicateNode, handleDownloadNode]);

const handleSaveSettings = useCallback(async (next: AppSettings) => {
setAppSettings(next);
await saveSettings(next);
}, []);

return (
<div className={`w-full h-full bg-[#070b14] flex flex-col mode-${interactionMode} text-white relative p-1 overflow-hidden`}>
<div className="absolute inset-0 pointer-events-none border border-[#F1641E]/20 z-[60] rounded-none lg:rounded-2xl" />
<div className="absolute inset-0 pointer-events-none border-[8px] border-[#0b1019] z-[55] rounded-none lg:rounded-2xl" />
<div className="flex-1 flex flex-col bg-[#0a0e17] rounded-none lg:rounded-xl overflow-hidden relative shadow-2xl">
<WorkspaceManager
workspaces={workspaces} activeId={activeWorkspaceId}
isGlobalPaused={false} onTogglePause={() => {}}
concurrency={concurrency} onChangeConcurrency={() => {}}
onRunPipeline={() => {
const currentNodes = getNodes();
const currentEdges = getEdges();
const dirty = currentNodes.filter(n => (n.type === 'imageGen' || n.type === 'videoGen') && isNodeDirty(n, currentEdges));
const ids = new Set<string>();
dirty.forEach(n => { ids.add(n.id); getDescendants(n.id, currentNodes, currentEdges).forEach(d => ids.add(d)); });
executeWorkflow(Array.from(ids));
}}
onStopPipeline={() => { stopFlagRef.current = true; setIsStopping(true); }} isStopping={isStopping} isRunning={runningChain}
filenamePrefix={filenamePrefix} onChangePrefix={setFilenamePrefix}
flowStatus={flowStatus} onClearFlowStatus={() => setFlowStatus(null)}
onSelect={handleSelectWorkspace} onAdd={handleAddWorkspace} onDelete={handleDeleteWorkspace} onRename={handleRenameWorkspace}
onOpenLog={() => setIsLogPanelOpen(!isLogPanelOpen)}
onOpenSettings={() => setIsSettingsOpen(!isSettingsOpen)}
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
<button onClick={handleExport} title="Xuất .bunnaflow" className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#F1641E]/10 border border-[#F1641E]/20 hover:bg-[#F1641E]/20 transition-all text-[#F1641E]">
<span className="material-symbols-outlined text-[18px]">download</span>
</button>
</div>
</div>
<div className="flex-1 relative bg-[#1C1C1C] flex">
{isNodeLibraryOpen && <NodeLibraryPanel onAdd={(type) => onAddManualNode(type)} onClose={() => setIsNodeLibraryOpen(false)} />}
{activeSettingsNodeId && <NodeSettingsPanel nodeId={activeSettingsNodeId} nodes={nodes} onUpdateData={(id, key, val) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [key]: val } } : n))} onClose={() => setActiveSettingsNodeId(null)} />}
{activeStyleSettingsNodeId && <StyleSettingsModal isOpen={!!activeStyleSettingsNodeId} nodeId={activeStyleSettingsNodeId} nodes={nodes} onUpdate={(id, key, val) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [key]: val } } : n))} onClose={() => setActiveStyleSettingsNodeId(null)} />}
{isLogPanelOpen && <ExecutionLogPanel logs={executionLogs} onClear={() => setExecutionLogs([])} onClose={() => setIsLogPanelOpen(false)} />}
{isSettingsOpen && <SettingsPanel settings={appSettings} onSave={handleSaveSettings} onClose={() => setIsSettingsOpen(false)} />}
<ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
onConnect={(p) => setEdges(eds => addEdge({ ...p, animated: false, style: { stroke: '#F1641E', strokeWidth: 3 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#F1641E' } }, eds))}
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
</ReactFlow>
{menuState && <ContextMenu x={menuState.x} y={menuState.y} onAddManualNode={(type) => onAddManualNode(type, menuState.flowPos)} onClose={() => setMenuState(null)} />}
{isBatchCombinedModalOpen && <BatchCombinedModal prefix={filenamePrefix} onChangePrefix={setFilenamePrefix} onConfirm={handleBatchConfirm} onCancel={() => setIsBatchCombinedModalOpen(false)} />}
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

export default () => (<ReactFlowProvider><FlowApp /></ReactFlowProvider>);
