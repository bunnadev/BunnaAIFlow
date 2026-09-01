import React from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import logo from '../assets/logo.png';

interface Props {
  onClose: () => void;
}

const LINKS = [
  { icon: 'send', label: 'Telegram', value: 't.me/huypham', href: 'https://t.me/huypham' },
  { icon: 'mail', label: 'Email', value: 'huypham@bunna.dev', href: 'mailto:huypham@bunna.dev' },
  { icon: 'language', label: 'Website', value: 'bunna.dev', href: 'https://bunna.dev' },
];

const AboutModal: React.FC<Props> = ({ onClose }) => (
  <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
    <div className="relative bg-[#0d1424] border border-[#F1641E]/20 rounded-2xl p-8 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col items-center text-center">
      <div className="w-16 h-16 rounded-full border border-[#F1641E]/40 bg-[#F1641E]/10 flex items-center justify-center overflow-hidden mb-4">
        <img src={logo} alt="Bunna AI Flow" className="w-full h-full object-cover" />
      </div>
      <h3 className="text-white font-black text-lg uppercase tracking-widest leading-none">BUNNA AI FLOW</h3>
      <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mt-2">Gemini Engine · v0.1.0</p>

      <div className="w-full h-px bg-white/10 my-6" />

      <div className="w-full flex flex-col gap-2">
        {LINKS.map((link) => (
          <button
            key={link.label}
            onClick={() => openUrl(link.href)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-white/[0.03] hover:bg-[#F1641E]/10 border border-white/5 hover:border-[#F1641E]/30 rounded-xl transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-white/5 group-hover:bg-[#F1641E]/20 flex items-center justify-center shrink-0 transition-all">
              <span className="material-symbols-outlined text-[#94a3b8] group-hover:text-[#F1641E] text-[16px] transition-all">{link.icon}</span>
            </div>
            <div className="flex flex-col items-start min-w-0">
              <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">{link.label}</span>
              <span className="text-[11px] font-bold text-white truncate">{link.value}</span>
            </div>
            <span className="material-symbols-outlined text-white/20 group-hover:text-[#F1641E] text-[16px] ml-auto transition-all">open_in_new</span>
          </button>
        ))}
      </div>

      <button
        onClick={onClose}
        className="mt-6 w-full py-2.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
      >
        Đóng
      </button>
    </div>
  </div>
);

export default AboutModal;
