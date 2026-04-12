import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CAT_COLORS, CAT_ICONS } from '../utils/data';
import './CategoryBlock.css';

interface CategoryBlockProps {
  cat: string;
  count: number;
  children: React.ReactNode;
  isDragging?: boolean;
  isOverlay?: boolean;
}

export default function CategoryBlock({ cat, count, children, isDragging, isOverlay }: CategoryBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: cat });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    '--cat-color': CAT_COLORS[cat] || 'var(--br-glass)'
  } as React.CSSProperties;

  const icon = CAT_ICONS[cat] || '📦';
  const currentTheme = document.body.dataset.theme || 'modern';
  const isAccent = currentTheme === 'accent';
  
  const dragHandleProps = {
    ...attributes,
    ...listeners,
  };
  
  const dragHandleIcon = (
    <div 
      className="cb-drag-handle"
      style={{
        color: isAccent ? '#ffffff' : '#c7c7cc',
        fontSize: '14px',
        cursor: 'grab',
        padding: '4px',
        margin: '0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none',
        opacity: isAccent ? 0.6 : 1
      }}
    >
      ☰
    </div>
  );

  return (
    <div 
      ref={setNodeRef}
      className={`cat-block ${isDragging ? 'dragging' : ''} ${isOverlay ? 'overlay' : ''}`} 
      style={style}
      data-cat={cat}
    >
      <div className="cb-capsule">
        {/* Monolithic color line of the capsule */}
        <div 
          className="cb-marker" 
          style={{ backgroundColor: CAT_COLORS[cat] || 'var(--br-glass)' }}
        />

        <div className="cb-hdr" {...dragHandleProps}>
          <div className="cb-hdr-left">
            <span className="cat-name">{cat.toUpperCase()}</span>
          </div>
          <div className="cb-hdr-right">
            <span className="cat-icon">{icon}</span>
            <span className="cat-cnt">{count}</span>
            <div className="cb-drag-handle-wrap">
              {dragHandleIcon}
            </div>
          </div>
        </div>

        <div className="cat-body">
          {children}
        </div>
      </div>
    </div>
  );
}
