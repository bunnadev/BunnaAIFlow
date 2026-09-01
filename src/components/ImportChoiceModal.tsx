import React from 'react';

interface Props {
  currentWorkspaceName: string;
  onReplace: () => void;
  onCreateNew: () => void;
  onCancel: () => void;
}

const ImportChoiceModal: React.FC<Props> = ({ currentWorkspaceName, onReplace, onCreateNew, onCancel }) => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onCancel} />
    <div className="relative bg-[#0d1424] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
      <h3 className="text-white font-black text-base mb-1.5 tracking-tighter uppercase">Nhập file workflow</h3>
      <p className="text-[#94a3b8] text-xs mb-5 leading-relaxed">
        Bạn muốn ghi đè lên workflow đang mở (<span className="text-white font-bold">{currentWorkspaceName}</span>) hay tạo workflow mới cho nội dung vừa nhập?
      </p>
      <div className="flex flex-col gap-2">
        <button
          onClick={onCreateNew}
          className="w-full py-3 bg-[#F1641E] hover:bg-[#F1641E]/80 text-black rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
        >
          Tạo workflow mới
        </button>
        <button
          onClick={onReplace}
          className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all border border-white/10"
        >
          Ghi đè workflow đang mở
        </button>
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

export default ImportChoiceModal;
