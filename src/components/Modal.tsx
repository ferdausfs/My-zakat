import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/5 sticky top-0 bg-[#141b2d] z-10">
          <h2 className="text-base font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition"
          >
            <i className="fas fa-times text-sm" />
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
