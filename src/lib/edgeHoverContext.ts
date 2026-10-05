import { createContext, useContext } from 'react';

// Trạng thái hover-để-làm-nổi-bật 1 dây nối truyền qua Context thay vì nhét
// vào edge.data — vì edge.data đi qua vòng round-trip của useReactFlow().setEdges()
// (dùng ở nút xoá tham chiếu trên các node) sẽ bị ReactFlow đọc lại state hiện
// tại rồi ghi thẳng xuống làm state gốc, khiến field "dimmed" tạm thời bị
// đóng băng vĩnh viễn vào state thật — dây bị mờ mãi mãi dù đã hết hover.
export const HoveredEdgeContext = createContext<string | null>(null);

export const useHoveredEdgeId = () => useContext(HoveredEdgeContext);
