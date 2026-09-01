import React from 'react';

interface Props {
  fileWorkspaceCount: number;
  currentWorkspaceCount: number;
  onReplaceAll: () => void;
  onAddAll: () => void;
  onCancel: () => void;
}

const ImportAllChoiceModal: React.FC<Props> = ({ fileWorkspaceCount, currentWorkspaceCount, onReplaceAll, onAddAll, onCancel }) => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onCancel} />
    <div className="relative bg-[#0d1424] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
      <h3 className="text-white font-black text-base mb-1.5 tracking-tighter uppercase">Nhập file backup ({fileWorkspaceCount} workflow)</h3>
      <p className="text-[#94a3b8] text-xs mb-5 leading-relaxed">
        File này chứa {fileWorkspaceCount} workflow. Bạn đang có {currentWorkspaceCount} workflow mở. Chọn cách xử lý:
      </p>
      <div className="flex flex-col gap-2">
        <button
          onClick={onAddAll}
          className="w-full py-3 bg-[#F1641E] hover:bg-[#F1641E]/80 text-black rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
        >
          Thêm tất cả vào danh sách hiện tại
        </button>
        <button
          onClick={onReplaceAll}
          className="w-full py-3 bg-[#e53935] hover:bg-[#c62828] text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
        >
          Thay thế TẤT CẢ workflow hiện tại
        </button>
        <p className="text-red-400/70 text-[9px] leading-relaxed -mt-1">
          ⚠ Toàn bộ {currentWorkspaceCount} workflow đang mở (kể cả kết quả đã tạo) sẽ bị xoá vĩnh viễn, thay bằng {fileWorkspaceCount} workflow trong file. Không thể hoàn tác.
        </p>
        <button
          onClick={onCancel}
          className="w-full py-2 text-[#94a3b8] hover:text-white text-[10px] uppercase tracking-widest transition-all"
        >
          Huỷ
        </button>
      </div>
    </div>
  </div>
);

export default ImportAllChoiceModal;
