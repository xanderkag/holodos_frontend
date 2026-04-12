import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import './EditRecipeModal.css';

interface EditRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, emoji: string) => void;
  initialName: string;
  initialEmoji: string;
}

export const EditRecipeModal: React.FC<EditRecipeModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialName, 
  initialEmoji 
}) => {
  const [name, setName] = useState(initialName);
  const [emoji, setEmoji] = useState(initialEmoji);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setEmoji(initialEmoji);
    }
  }, [isOpen, initialName, initialEmoji]);

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Редактировать рецепт"
      onSave={() => onSave(name, emoji)}
    >
      <div className="erm-container">
        <div className="erm-field">
          <label className="erm-label">Название</label>
          <input 
            className="erm-input" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            placeholder="Название рецепта..."
          />
        </div>
        <div className="erm-field">
          <label className="erm-label">Эмодзи</label>
          <input 
            className="erm-input erm-emoji" 
            value={emoji} 
            onChange={e => setEmoji(e.target.value)} 
            placeholder="🍲"
          />
        </div>
      </div>
    </Modal>
  );
};
