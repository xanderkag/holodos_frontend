import React from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onSave?: () => void;
  onDelete?: () => void;
  onEat?: () => void;
  hideSave?: boolean;
  hideHeader?: boolean;
  hideFooter?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, onClose, title, children, onSave, onDelete, onEat, hideSave, hideHeader, hideFooter 
}) => {
  React.useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <div className={`moverlay ${isOpen ? 'show' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal glass-panel slide-up-anim">
        {!hideHeader && (
          <>
            <div className="mhandle"></div>
            <div className="mtitle">{title}</div>
          </>
        )}
        
        <div className="mcontent">
          {children}
        </div>
        
        {!hideFooter && (
          <div className="macts-col" style={{display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px'}}>
            {onEat && (
               <button 
                 className="mbtn mbeat" 
                 style={{background: 'linear-gradient(135deg, #FF9500 0%, #FF2D55 100%)', color: '#fff', width: '100%', height: '50px', boxShadow: '0 4px 12px rgba(255, 45, 85, 0.3)'}} 
                 onClick={onEat}
               >
                 🍽️ В дневник
               </button>
            )}
            <div className="macts" style={{marginTop: 0}}>
              <button className="mbtn mbcancel" onClick={onClose}>Отмена</button>
              {onDelete && <button className="mbtn mbdel" onClick={onDelete}>Удалить</button>}
              {(!hideSave && onSave) && <button className="mbtn mbsave" onClick={onSave}>Сохранить</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
