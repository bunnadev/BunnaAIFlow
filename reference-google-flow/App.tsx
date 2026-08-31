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
Viewport,
Background,
BackgroundVariant
} from 'reactflow';
import { Flow } from 'flow-sdk';

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
import { QuickPreviewModal } from './components/UI';

// --- TYPES & UTILS ---
export interface LogEntry {
id: string;
nodeId: string;
nodeName: string;
status: 'pending' | 'running' | 'success' | 'error';
message: string;
timestamp: number;
}

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

interface Workspace {
id: string;
name: string;
nodes: Node[];
edges: Edge[];
viewport?: Viewport;
}

interface UndoState {
nodes: Node[];
edges: Edge[];
}

const FlowApp: React.FC = () => {
const [workspaces, setWorkspaces] = useState<Workspace[]>([
{ id: 'ws_default', name: 'Workflow 1', nodes: [], edges: [] }
]);
const [activeWorkspaceId, setActiveWorkspaceId] = useState('ws_default');
const [interactionMode, setInteractionMode] = useState<InteractionMode>('select');

const [menuState, setMenuState] = useState<{ x: number, y: number, flowPos: { x: number, y: number }, visible: boolean } | null>(null);
const [isNodeLibraryOpen, setIsNodeLibraryOpen] = useState(false);
const [isLogPanelOpen, setIsLogPanelOpen] = useState(false);
const [executionLogs, setExecutionLogs] = useState<LogEntry[]>([]);
const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

const [isBatchCombinedModalOpen, setIsBatchCombinedModalOpen] = useState(false);
const [previewDataState, setPreviewDataState] = useState<{ open: boolean; type: 'image' | 'video'; src: string; title?: string; } | null>(null);

const [filenamePrefix, setFilenamePrefix] = useState('BUNNA_FLOW');
const [concurrency, setConcurrency] = useState(2);
const [isStopping, setIsStopping] = useState(false);

const [flowStatus, setFlowStatus] = useState<{ message: string, type: 'info' | 'error' | 'success' | 'warning', canUndo?: boolean } | null>(null);
const [runningChain, setRunningChain] = useState(false);
const [activeJobs, setActiveJobs] = useState<number>(0);

const [activeSettingsNodeId, setActiveSettingsNodeId] = useState<string | null>(null);
const [activeStyleSettingsNodeId, setActiveStyleSettingsNodeId] = useState<string | null>(null);

const [nodes, setNodes, onNodesChange] = useNodesState([]);
const [edges, setEdges, onEdgesChange] = useEdgesState([]);

// Undo/Redo System
const [undoStack, setUndoStack] = useState<UndoState[]>([]);
const { screenToFlowPosition, getNodes, getEdges, setViewport, getViewport } = useReactFlow();

const stopFlagRef = useRef(false);
const activeJobsRef = useRef(0);
const fileInputRef = useRef<HTMLInputElement>(null);

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

const onNodesDelete = useCallback((deleted: Node[]) => {
setUndoStack(prev => [...prev, { nodes: getNodes(), edges: getEdges() }]);
setFlowStatus({ message: 'ĐÃ XOÁ NODE. NHẤN CTRL+Z ĐỂ HOÀN TÁC', type: 'warning', canUndo: true });
setTimeout(() => setFlowStatus(null), 5000);
}, [getNodes, getEdges]);

const onEdgesDelete = useCallback((deleted: Edge[]) => {
setUndoStack(prev => [...prev, { nodes: getNodes(), edges: getEdges() }]);
}, [getNodes, getEdges]);

// Global UI Styles (Updated for 70% scale)
useEffect(() => {
const id = 'flow-app-global-styles-v6';
if (document.getElementById(id)) return;
const style = document.createElement('style');
style.id = id;
style.textContent = `
.node-container { background: #0d1424; border: 1px solid rgba(241, 100, 30, 0.15); border-radius: 0.8rem; box-shadow: 0 5px 25px rgba(0, 0, 0, 0.6); transition: border-color 0.3s ease, box-shadow 0.3s ease; }
.node-container:hover { border-color: rgba(241, 100, 30, 0.4); box-shadow: 0 10px 35px rgba(0, 0, 0, 0.8); }

/* NODE SELECTED STYLING */
.react-flow__node.selected .node-container { border-color: #ffffff !important; box-shadow: 0 0 20px rgba(255, 255, 255, 0.1); }

.react-flow__edge-path { stroke-width: 2.5; transition: stroke 0.2s, stroke-width 0.2s; cursor: pointer; }
.react-flow__edge:hover .react-flow__edge-path { stroke-width: 4; stroke: #F1641E !important; }
.react-flow__handle { width: 8px !important; height: 8px !important; border: 1.5px solid #0d1424 !important; }
.react-flow__controls button { background: #0d1424 !important; border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important; fill: #94a3b8 !important; }
.react-flow__controls button:hover { background: #F1641E !important; fill: #000 !important; }
.custom-scrollbar::-webkit-scrollbar { width: 3px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(241, 100, 30, 0.2); border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(241, 100, 30, 0.5); }
@keyframes slide-in-panel { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@keyframes slide-in-panel-left { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
.animate-slide-panel { animation: slide-in-panel 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
.animate-slide-panel-left { animation: slide-in-panel-left 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
.mode-hand .react-flow__pane { cursor: grab !important; }
.mode-hand .react-flow__pane:active { cursor: grabbing !important; }
@keyframes dropdown-fade { from { opacity: 0; transform: translateY(-10px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
.animate-dropdown-fast { animation: dropdown-fade 0.2s cubic-bezier(0, 0, 0.2, 1) forwards; }
`;
document.head.appendChild(style);
}, []);

// RF Style
useEffect(() => {
const rfId = 'react-flow-css';
if (!document.getElementById(rfId)) {
const link = document.createElement('link'); link.id = rfId; link.rel = 'stylesheet';
link.href = 'https://cdn.jsdelivr.net/npm/reactflow@11.10.1/dist/style.css';
document.head.appendChild(link);
}
}, []);

const extractMediaInfo = (dataUrl: string) => {
const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
if (match) return { mimeType: match[1], base64: match[2] };
return null;
};

const handleResetAllResults = useCallback(() => {
setNodes(nds => nds.map(node => {
if (node.type === 'imageGen' || node.type === 'videoGen') {
return {
...node,
data: {
...node.data,
result: null,
statusText: '',
isFinalized: false,
isLoading: false,
}
};
}
return node;
}));
setFlowStatus({ message: 'ĐÃ RESET KẾT QUẢ CÁC NODE', type: 'info' });
setTimeout(() => setFlowStatus(null), 2000);
}, [setNodes]);

const saveCurrentToWorkspace = useCallback(() => {
setWorkspaces(prev => prev.map(ws => ws.id === activeWorkspaceId ? {
...ws,
nodes,
edges,
viewport: getViewport()
} : ws));
}, [activeWorkspaceId, nodes, edges, getViewport]);

const handleSelectWorkspace = useCallback((id: string) => {
saveCurrentToWorkspace();
const target = workspaces.find(w => w.id === id);
if (target) {
setActiveWorkspaceId(id);
setNodes(target.nodes || []);
setEdges(target.edges || []);
if (target.viewport) {
setViewport(target.viewport);
}
}
}, [saveCurrentToWorkspace, workspaces, setNodes, setEdges, setViewport]);

const handleAddWorkspace = useCallback(() => {
saveCurrentToWorkspace();
const newId = `ws_${Date.now()}`;
const newWs: Workspace = {
id: newId,
name: `Workflow ${workspaces.length + 1}`,
nodes: [],
edges: []
};
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
const currentFullState = workspaces.map(ws => ws.id === activeWorkspaceId ? {
...ws,
nodes,
edges,
viewport: getViewport()
} : ws);

const json = JSON.stringify(currentFullState, null, 2);
const base64 = btoa(unescape(encodeURIComponent(json)));
await Flow.download({
base64,
mimeType: 'application/json',
filename: `bunna_flow_config_${new Date().getTime()}.json`
});
}, [workspaces, activeWorkspaceId, nodes, edges, getViewport]);

const calculateHashManual = (node: Node, allNodes: Node[], allEdges: Edge[]) => {
const incomingMediaEdges = allEdges.filter(e => e.target === node.id && e.targetHandle === 'media-in');
const incomingMediaIds = incomingMediaEdges.map(e => {
const srcNode = allNodes.find(n => n.id === e.source);
return srcNode?.data?.result?.mediaId || srcNode?.data?.media?.mediaId || '';
}).sort().join('|');

const incomingStyleEdges = allEdges.filter(e => e.target === node.id && e.targetHandle === 'style-in');
const styleStrings = incomingStyleEdges.map(e => {
const srcNode = allNodes.find(n => n.id === e.source);
if (srcNode?.type === 'styleNode') {
return `${srcNode.data.positivePrompt || ''}|${srcNode.data.negativePrompt || ''}`;
}
return srcNode?.data?.style || '';
}).sort().join('|');

return [node.data.model, node.data.localPrompt, node.data.aspectRatio, node.data.resolution, node.data.duration, incomingMediaIds, styleStrings].join('::');
};

const addLog = useCallback((nodeId: string, nodeName: string, status: LogEntry['status'], message: string) => {
setExecutionLogs(prev => [
{ id: `log_${Date.now()}_${nodeId}`, nodeId, nodeName, status, message, timestamp: Date.now() },
...prev.slice(0, 49) // Keep last 50
]);
}, []);

const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
const file = e.target.files?.[0];
if (!file) return;
setFlowStatus({ message: 'ĐANG NHẬP VÀ KHÔI PHỤC THAM CHIẾU...', type: 'info' });
addLog('system', 'Hệ thống', 'running', `Bắt đầu nhập cấu hình từ tệp: ${file.name}`);

try {
const text = await file.text();
const data = JSON.parse(text);

if (Array.isArray(data) && data.length > 0) {
const restoredWorkspaces = [...data];
for (const ws of restoredWorkspaces) {
if (ws.nodes && Array.isArray(ws.nodes)) {
for (const node of ws.nodes) {
if (node.data?.media?.url) {
const info = extractMediaInfo(node.data.media.url);
if (info) {
try {
addLog(node.id, node.data.label || node.id, 'running', `Đang khôi phục media gốc cho node: ${node.data.label || node.id}`);
const upload = await Flow.upload({
base64: info.base64,
mimeType: info.mimeType as any,
name: node.data.media.name || 'Imported Media'
});
node.data.media.mediaId = upload.mediaId;
} catch (err) { console.warn("Failed to restore media ID", err); }
}
}
if (node.data?.result?.url) {
const info = extractMediaInfo(node.data.result.url);
if (info) {
try {
addLog(node.id, node.data.label || node.id, 'running', `Đang khôi phục kết quả đã có cho node: ${node.data.label || node.id}`);
const upload = await Flow.upload({
base64: (info.mimeType === 'video/mp4' || info.mimeType.startsWith('image')) ? info.base64 : 'image/png' as any,
mimeType: (info.mimeType === 'video/mp4' || info.mimeType.startsWith('image')) ? info.mimeType : 'image/png' as any,
name: 'Imported Result'
});
node.data.result.mediaId = upload.mediaId;
} catch (err) { console.warn("Failed to restore result ID", err); }
}
}
}
}
}

for (const ws of restoredWorkspaces) {
if (ws.nodes && Array.isArray(ws.nodes)) {
for (const node of ws.nodes) {
if (node.data.isFinalized && node.data.result) {
node.data.lastRunHash = calculateHashManual(node, ws.nodes, ws.edges);
}
}
}
}

setWorkspaces(restoredWorkspaces);
const first = restoredWorkspaces[0];
setActiveWorkspaceId(first.id);
setNodes(first.nodes || []);
setEdges(first.edges || []);
if (first.viewport) setViewport(first.viewport);
setFlowStatus({ message: 'NHẬP VÀ KHÔI PHỤC THÀNH CÔNG', type: 'success' });
addLog('system', 'Hệ thống', 'success', 'Hoàn tất nhập workflow và khôi phục toàn bộ tham chiếu.');
}
} catch (err) {
console.error("Import failed:", err);
setFlowStatus({ message: 'LỖI ĐỊNH DẠNG HOẶC KHÔNG THỂ KHÔI PHỤC', type: 'error' });
addLog('system', 'Hệ thống', 'error', 'Lỗi trong quá trình nhập tệp JSON.');
} finally {
e.target.value = '';
setTimeout(() => setFlowStatus(null), 3000);
}
}, [setNodes, setEdges, setViewport, addLog]);

const getNodeStateHash = useCallback((node: Node, edges: Edge[]) => {
const currentNodes = getNodes();
const incomingMediaEdges = edges.filter(e => e.target === node.id && e.targetHandle === 'media-in');
const incomingMediaIds = incomingMediaEdges.map(e => {
const srcNode = currentNodes.find(n => n.id === e.source);
return srcNode?.data?.result?.mediaId || srcNode?.data?.media?.mediaId || '';
}).sort().join('|');

const incomingStyleEdges = edges.filter(e => e.target === node.id && e.targetHandle === 'style-in');
const styleStrings = incomingStyleEdges.map(e => {
const srcNode = currentNodes.find(n => n.id === e.source);
if (srcNode?.type === 'styleNode') {
return `${srcNode.data.positivePrompt || ''}|${srcNode.data.negativePrompt || ''}`;
}
return srcNode?.data?.style || '';
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
const commonData = { isLoading: false, statusText: '', result: null, isFinalized: false, isBatch: false, filenamePrefix: filenamePrefix };
let newNode: Node;
switch (type) {
case 'mediaSource': newNode = { id, type, position: finalPos, data: { ...commonData, label: 'Nguồn Media', media: null } }; break;
case 'imageGen': newNode = { id, type, position: finalPos, data: { ...commonData, label: 'Ảnh AI', model: '🍌 Nano Banana Pro', aspectRatio: '16:9', resolution: '4k', localPrompt: '', assetKind: 'I' } }; break;
case 'videoGen': newNode = { id, type, position: finalPos, data: { ...commonData, label: 'Video AI', model: 'Omni Flash', aspectRatio: '16:9', resolution: '720p', duration: 10, videoMode: 'frame', voiceOverEnabled: false, voiceOverVoice: 'Puck — Upbeat', localPrompt: '', assetKind: 'V' } }; break;
case 'styleNode': newNode = { id, type, position: finalPos, data: { ...commonData, label: 'Phong cách', positivePrompt: '', negativePrompt: '' } }; break;
default: return;
}
setNodes((nds) => nds.concat(newNode)); setMenuState(null);
}, [setNodes, filenamePrefix, getViewport]);

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
isLoading: false,
statusText: '',
result: null,
isFinalized: false,
isWaiting: false,
isPaused: false
}
};
setNodes((nds) => nds.concat(newNode));
}, [getNodes, setNodes]);

const handleBatchConfirm = useCallback(async (imgPrompts: string[], vidPrompts: string[], settings: any, refs: any[]) => {
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
id,
type: 'mediaSource',
position: { x: startX, y: startY + (i * 260) },
data: {
label: `Ref #${i + 1}`,
media: {
mediaId: ref.mediaId,
url: `data:${ref.mimeType};base64,${ref.base64}`,
name: ref.name || `Reference ${i + 1}`,
type: ref.type
},
isBatch: true,
isLoading: false,
statusText: '',
isFinalized: false
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
id: imgId,
type: 'imageGen',
position: { x: genStartX, y: rowY },
data: {
label: `Ảnh ${i + 1}`,
model: settings.imageModel,
aspectRatio: settings.imageAspectRatio,
resolution: settings.imageResolution,
localPrompt: imgPrompts[i],
isLoading: false,
statusText: '',
result: null,
isFinalized: false,
isBatch: true,
isPaused: false
}
};
newNodes.push(imgNode);
lastGenNodeId = imgId;

refNodeIds.forEach((refId, rIdx) => {
newEdges.push({
id: `edge_batch_ref_${refId}_to_${imgId}_${rIdx}`,
source: refId,
target: imgId,
targetHandle: 'media-in',
style: { stroke: '#F1641E', strokeWidth: 3 },
markerEnd: { type: MarkerType.ArrowClosed, color: '#F1641E' }
});
});
}

if (vidPrompts[i]) {
const vidId = `videoGen_batch_${Date.now()}_${i}`;
const vidNode: Node = {
id: vidId,
type: 'videoGen',
position: { x: genStartX + 320, y: rowY },
data: {
label: `Video ${i + 1}`,
model: settings.videoModel,
aspectRatio: settings.videoAspectRatio,
resolution: settings.videoResolution,
duration: settings.duration,
videoMode: settings.videoMode,
voiceOverEnabled: settings.voiceOverEnabled,
voiceOverVoice: settings.voiceOverVoice,
localPrompt: vidPrompts[i],
isLoading: false,
statusText: '',
result: null,
isFinalized: false,
isBatch: true,
isPaused: false
}
};
newNodes.push(vidNode);

if (lastGenNodeId) {
newEdges.push({
id: `edge_batch_img_${lastGenNodeId}_to_${vidId}`,
source: lastGenNodeId,
target: vidId,
targetHandle: 'media-in',
style: { stroke: '#F1641E', strokeWidth: 3 },
markerEnd: { type: MarkerType.ArrowClosed, color: '#F1641E' }
});
} else {
refNodeIds.forEach((refId, rIdx) => {
newEdges.push({
id: `edge_batch_ref_${refId}_to_${vidId}_${rIdx}`,
source: refId,
target: vidId,
targetHandle: 'media-in',
style: { stroke: '#F1641E', strokeWidth: 3 },
markerEnd: { type: MarkerType.ArrowClosed, color: '#F1641E' }
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

const { url, mimeType } = node.data.result;
const base64 = url.split(',')[1];
const index = getNodes().filter(n => n.type === node.type).indexOf(node);
const filename = getNodeFileName(node, index, filenamePrefix);

try {
await Flow.download({
base64,
mimeType,
filename
});
} catch (err) {
console.error("Download failed:", err);
}
}, [getNodes, filenamePrefix]);

const runNodeLogic = async (nodeId: string, nodesSnapshot?: Node[], edgesSnapshot?: Edge[]) => {
const currentNodes = nodesSnapshot || getNodes();
const currentEdges = edgesSnapshot || getEdges();
const node = currentNodes.find(n => n.id === nodeId);
if (!node) return;

const incomingEdges = currentEdges.filter(e => e.target === nodeId);
const sourceImages: any[] = [];
const sourceVideos: any[] = [];
let styleText = "";

for (const edge of incomingEdges) {
const src = currentNodes.find(n => n.id === edge.source);
if (!src) continue;

if (edge.targetHandle === 'media-in') {
const mediaData = src.data.result || src.data.media;
if (mediaData) {
if (mediaData.type === 'image') sourceImages.push(mediaData);
else if (mediaData.type === 'video') sourceVideos.push(mediaData);
}
} else if (edge.targetHandle === 'style-in') {
if (src.type === 'styleNode' && src.data.positivePrompt) {
styleText += (styleText ? ", " : "") + src.data.positivePrompt;
}
}
}

setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, isLoading: true, statusText: 'Đang xử lý...', isFinalized: false } } : n));

try {
let res: any = null;
const basePrompt = node.data.localPrompt || 'A cinematic masterpiece';
const promptWithStyle = styleText ? `${basePrompt}, ${styleText}` : basePrompt;
const finalPrompt = promptWithStyle + (node.data.resolution === '4k' ? ", ultra high quality, 8k" : "");

if (node.type === 'imageGen') {
res = await Flow.generate.image({
prompt: finalPrompt,
referenceImageMediaIds: sourceImages.length ? sourceImages.map(m => m.mediaId).slice(0, 10) : undefined,
modelDisplayName: node.data.model,
aspectRatio: node.data.aspectRatio as any
});
} else if (node.type === 'videoGen') {
const finalDuration = node.data.model === 'Omni Flash' ? node.data.duration : 8;
const videoOptions: any = {
prompt: finalPrompt,
modelDisplayName: node.data.model,
aspectRatio: node.data.aspectRatio as any,
durationSeconds: finalDuration
};

if (node.data.videoMode === 'frame') {
if (sourceImages.length > 2) throw new Error("CHẾ ĐỘ KHUNG HÌNH CHỈ HỖ TRỢ TỐI ĐA 2 ẢNH ĐẦU VÀO.");
if (sourceImages.length === 1) videoOptions.firstFrameImageMediaId = sourceImages[0].mediaId;
else if (sourceImages.length === 2) {
videoOptions.firstFrameImageMediaId = sourceImages[0].mediaId;
videoOptions.lastFrameImageMediaId = sourceImages[1].mediaId;
}
} else {
if (sourceImages.length > 0) videoOptions.referenceImageMediaIds = sourceImages.map(m => m.mediaId).slice(0, 5);
}

if (sourceVideos.length > 0) {
videoOptions.sourceVideoMediaId = sourceVideos[0].mediaId;
videoOptions.sourceVideoMode = 'edit';
}

if (node.data.voiceOverEnabled) {
videoOptions.voiceOverEnabled = true;
videoOptions.voiceOverVoice = node.data.voiceOverVoice;
}

res = await Flow.generate.video(videoOptions);
}

if (res && res.mediaId) {
setNodes(nds => nds.map(n => n.id === nodeId ? {
...n,
data: {
...n.data, isLoading: false, statusText: 'Hoàn tất', isFinalized: true,
lastRunHash: getNodeStateHash(node, currentEdges),
result: { mediaId: res.mediaId, url: `data:${res.mimeType};base64,${res.base64}`, type: node.type === 'imageGen' ? 'image' : 'video', mimeType: res.mimeType, resolution: node.data.resolution }
}
} : n));
return res;
} else throw new Error("API Response Error");
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

const isNodeReady = (nodeId: string, edges: Edge[]) => {
const parentEdges = edges.filter(e => e.target === nodeId);
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
if (!node) {
remainingNodes.delete(nodeId);
continue;
}

if (!isNodeDirty(node, currentEdges)) {
remainingNodes.delete(nodeId);
completedNodes.add(nodeId);
addLog(nodeId, node.data.label || nodeId, 'success', 'Bỏ qua (Dữ liệu đã sẵn sàng).');
continue;
}

remainingNodes.delete(nodeId);
processingNodes.add(nodeId);
activeJobsRef.current++;
setActiveJobs(activeJobsRef.current);

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
setActiveJobs(activeJobsRef.current);
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
}, [getNodes, getEdges, concurrency, runningChain, addLog, isNodeDirty, runNodeLogic]);

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
}, [getNodes, getEdges, isNodeDirty, onDuplicateNode, handleDownloadNode]);

return (
<div className={`w-full h-full bg-[#070b14] flex flex-col mode-${interactionMode} text-white relative p-1 overflow-hidden`}>
<input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />
<div className="absolute inset-0 pointer-events-none border border-[#F1641E]/20 z-[60] rounded-none lg:rounded-2xl" />
<div className="absolute inset-0 pointer-events-none border-[8px] border-[#0b1019] z-[55] rounded-none lg:rounded-2xl" />
<div className="flex-1 flex flex-col bg-[#0a0e17] rounded-none lg:rounded-xl overflow-hidden relative shadow-2xl">
<WorkspaceManager
workspaces={workspaces} activeId={activeWorkspaceId}
isGlobalPaused={false} onTogglePause={() => {}}
concurrency={concurrency} onChangeConcurrency={setConcurrency}
onRunPipeline={() => {
const currentNodes = getNodes();
const currentEdges = getEdges();
const dirty = currentNodes.filter(n => (n.type === 'imageGen' || n.type === 'videoGen') && isNodeDirty(n, currentEdges));
let ids = new Set<string>();
dirty.forEach(n => { ids.add(n.id); getDescendants(n.id, currentNodes, currentEdges).forEach(d => ids.add(d)); });
executeWorkflow(Array.from(ids));
}}
onStopPipeline={() => { stopFlagRef.current = true; setIsStopping(true); }} isStopping={isStopping}
filenamePrefix={filenamePrefix} onChangePrefix={setFilenamePrefix}
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
<ToolbarButton active={interactionMode === 'connect'} icon="link" label="LINK" onClick={() => setInteractionMode('connect')} />
</div>
<div className="w-8 h-[1px] bg-white/10 my-1" />
<button onClick={() => setIsBatchCombinedModalOpen(true)} className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#F1641E]/10 border border-[#F1641E]/20 hover:bg-[#F1641E]/20 transition-all text-[#F1641E]">
<span className="material-symbols-outlined text-[18px]">dynamic_feed</span>
</button>
<button onClick={handleResetAllResults} title="Reset kết quả" className="w-9 h-9 rounded-lg flex items-center justify-center bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all text-red-400">
<span className="material-symbols-outlined text-[18px]">restart_alt</span>
</button>
<div className="mt-auto flex flex-col gap-2 mb-2">
<button onClick={() => fileInputRef.current?.click()} title="Import JSON" className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#F1641E]/10 border border-[#F1641E]/20 hover:bg-[#F1641E]/20 transition-all text-[#F1641E]">
<span className="material-symbols-outlined text-[18px]">upload</span>
</button>
<button onClick={handleExport} title="Export JSON" className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#F1641E]/10 border border-[#F1641E]/20 hover:bg-[#F1641E]/20 transition-all text-[#F1641E]">
<span className="material-symbols-outlined text-[18px]">download</span>
</button>
<button onClick={() => setIsInfoModalOpen(true)} title="Thông tin quy trình" className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-white/40 hover:text-white">
<span className="material-symbols-outlined text-[18px]">info</span>
</button>
</div>
</div>
<div className="flex-1 relative bg-[#1C1C1C] flex">
{isNodeLibraryOpen && <NodeLibraryPanel onAdd={(type) => onAddManualNode(type)} onClose={() => setIsNodeLibraryOpen(false)} />}
{activeSettingsNodeId && <NodeSettingsPanel nodeId={activeSettingsNodeId} nodes={nodes} onUpdateData={(id, key, val) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [key]: val } } : n))} onClose={() => setActiveSettingsNodeId(null)} />}
{activeStyleSettingsNodeId && <StyleSettingsModal isOpen={!!activeStyleSettingsNodeId} nodeId={activeStyleSettingsNodeId} nodes={nodes} onUpdate={(id, key, val) => setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [key]: val } } : n))} onClose={() => setActiveStyleSettingsNodeId(null)} />}
{isLogPanelOpen && <ExecutionLogPanel logs={executionLogs} onClear={() => setExecutionLogs([])} onClose={() => setIsLogPanelOpen(false)} />}
<ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
onConnect={(p) => setEdges(eds => addEdge({ ...p, animated: false, style: { stroke: '#F1641E', strokeWidth: 3 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#F1641E' } }, eds))}
onPaneContextMenu={(e) => { e.preventDefault(); const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY }); setMenuState({ x: e.clientX, y: e.clientY, flowPos, visible: true }); }}
onPaneClick={() => { setMenuState(null); setIsNodeLibraryOpen(false); setActiveSettingsNodeId(null); setActiveStyleSettingsNodeId(null); }}
onNodesDelete={onNodesDelete} onEdgesDelete={onEdgesDelete}
nodeTypes={NODE_TYPES} edgeTypes={EDGE_TYPES} snapToGrid snapGrid={[10, 10]}
panOnDrag={interactionMode === 'hand' ? true : [1, 2]} selectionOnDrag={interactionMode === 'select'} selectionMode={SelectionMode.Partial} panOnScroll zoomOnScroll minZoom={0.05} maxZoom={4}
>
<Background variant={BackgroundVariant.Dots} gap={10} size={1} color="#333" />
<Controls showInteractive={false} position="bottom-left" />
<Panel position="bottom-right" className="m-4"><BatchExportPanel nodes={nodes} globalPrefix={filenamePrefix} /></Panel>
</ReactFlow>
{menuState && <ContextMenu x={menuState.x} y={menuState.y} onAddManualNode={(type) => onAddManualNode(type, menuState.flowPos)} onClose={() => setMenuState(null)} />}
{isBatchCombinedModalOpen && <BatchCombinedModal prefix={filenamePrefix} onChangePrefix={setFilenamePrefix} onConfirm={handleBatchConfirm} onCancel={() => setIsBatchCombinedModalOpen(false)} />}
{previewDataState && <QuickPreviewModal open={previewDataState.open} type={previewDataState.type} src={previewDataState.src} title={previewDataState.title} onClose={() => setPreviewDataState(null)} />}
<InfoModal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} />
</div>
</div>
</div>
</div>
);
};

const InfoModal: React.FC<{ isOpen: boolean, onClose: () => void }> = ({ isOpen, onClose }) => {
if (!isOpen) return null;
return (
<div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 animate-in fade-in duration-200">
<div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
<div className="relative bg-[#0d1424] border border-[#F1641E]/20 rounded-xl p-6 w-full max-w-xs shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-in zoom-in duration-200">
<div className="flex items-center gap-3 mb-4">
<div className="w-8 h-8 rounded-lg bg-[#F1641E]/10 border border-[#F1641E]/20 flex items-center justify-center">
<span className="material-symbols-outlined text-[#F1641E] text-lg">info</span>
</div>
<h3 className="text-white font-black text-base tracking-tighter uppercase">Thông tin quy trình</h3>
</div>
<div className="flex flex-col gap-4 text-xs">
<div className="flex flex-col gap-1">
<span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Liên hệ</span>
<div className="flex items-center gap-2 text-[#F1641E] font-bold select-all cursor-pointer">
<span className="material-symbols-outlined text-xs">send</span>
<span>t.me/huypham</span>
</div>
</div>
<div className="flex flex-col gap-1">
<span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Website</span>
<div className="flex items-center gap-2 text-[#F1641E] font-bold select-all cursor-pointer">
<span className="material-symbols-outlined text-xs">language</span>
<span>bunna.dev</span>
</div>
<p className="text-[9px] text-[#94a3b8] leading-relaxed italic mt-1 font-medium">Chia sẻ quy trình và ứng dụng tự động hoá.</p>
</div>
</div>
<button onClick={onClose} className="mt-6 w-full py-3 bg-[#F1641E] hover:bg-[#F1641E]/80 text-black rounded-xl font-black text-[9px] transition-all uppercase tracking-widest shadow-xl active:scale-95">Đã hiểu</button>
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
