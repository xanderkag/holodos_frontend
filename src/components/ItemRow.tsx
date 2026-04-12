import { useState, useRef } from 'react';
import { CAT_COLORS } from '../utils/data';
import type { Item } from '../utils/data';
import './ItemRow.css';

interface ItemRowProps {
  item: Item;
  onToggle?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (item: Item) => void;
  onAddToList?: (item: Item) => void;
  onRowClick?: (item: Item) => void;
  onLongPress?: (item: Item) => void;
  onSwipeRight?: (item: Item) => void;
  onSwipeLeft?: (item: Item) => void;
  hideBullet?: boolean;
  isFirstInCategory?: boolean;
  isLastInCategory?: boolean;
  swipeRightIcon?: string;
  swipeLeftIcon?: string;
  swipeRightColor?: string;
  swipeLeftColor?: string;
}

export default function ItemRow({ 
  item, 
  onToggle, 
  onDelete, 
  onEdit, 
  onAddToList, 
  onRowClick,
  onLongPress,
  onSwipeRight,
  onSwipeLeft,
  hideBullet,
  isFirstInCategory,
  isLastInCategory,
  swipeRightIcon,
  swipeLeftIcon,
  swipeRightColor,
  swipeLeftColor
}: ItemRowProps) {
  const [swipeX, setSwipeX] = useState(0);
  const [isPressed, setIsPressed] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isMoving = useRef(false);
  const longPressTimer = useRef<any>(null);
  const wasLongPress = useRef(false);
  const threshold = 80;

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'targetTouches' in e ? e.targetTouches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'targetTouches' in e ? e.targetTouches[0].clientY : (e as React.MouseEvent).clientY;
    
    startX.current = clientX;
    startY.current = clientY;
    isMoving.current = true;
    wasLongPress.current = false;
    setIsPressed(true);

    longPressTimer.current = setTimeout(() => {
      if (isMoving.current && Math.abs(swipeX) < 10) {
        wasLongPress.current = true;
        onLongPress?.(item);
        if (navigator.vibrate) navigator.vibrate(40);
        setIsPressed(false);
      }
    }, 600);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isMoving.current) return;
    const currentX = 'targetTouches' in e ? e.targetTouches[0].clientX : (e as React.MouseEvent).clientX;
    const currentY = 'targetTouches' in e ? e.targetTouches[0].clientY : (e as React.MouseEvent).clientY;
    
    const diffX = currentX - startX.current;
    const diffY = currentY - startY.current;

    if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
    
    if (Math.abs(diffX) > 5) {
      const resistance = Math.abs(diffX) > 150 ? 0.3 : 1;
      setSwipeX(diffX * resistance);
      
      if (Math.abs(diffX) > 15 && 'cancelable' in e && (e as any).cancelable) {
        (e as any).preventDefault();
      }
    }
  };

  const handleTouchEnd = () => {
    isMoving.current = false;
    setIsPressed(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    
    if (swipeX > threshold) {
      if (onSwipeRight) onSwipeRight(item);
      else if (onAddToList) onAddToList(item);
    } else if (swipeX < -threshold) {
      if (onSwipeLeft) onSwipeLeft(item);
      else if (onDelete) onDelete(item.id);
    }
    
    setSwipeX(0);
  };

  const swipeAbs = Math.abs(swipeX);
  const opacity = Math.min(swipeAbs / threshold, 1);
  
  // Default colors
  const green = 'rgba(52, 199, 89, opacity)';
  const red = 'rgba(255, 59, 48, opacity)';
  
  const currentSwipeColor = swipeX > 0 
    ? (swipeRightColor || green).replace('opacity', opacity.toString())
    : (swipeLeftColor || red).replace('opacity', opacity.toString());
  
  let swipeIcon = swipeX > 0 
    ? (swipeRightIcon || '✅') 
    : (swipeLeftIcon || '✕');

  return (
    <div
      className={`item-row ${item.isChecked ? 'checked' : ''} ${hideBullet ? 'no-bullet' : ''} ${onRowClick ? 'interactive' : ''} ${isFirstInCategory ? 'first-in-cat' : ''} ${isLastInCategory ? 'last-in-cat' : ''} ${isPressed ? 'is-pressed' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseMove={handleTouchMove}
      onMouseUp={handleTouchEnd}
      onMouseLeave={handleTouchEnd}
      onClick={(e) => {
        if (Math.abs(swipeX) < 10 && !wasLongPress.current) {
          e.stopPropagation();
          onRowClick?.(item);
        }
      }}
    >
      <div 
        className="swipe-bg" 
        style={{ 
          backgroundColor: currentSwipeColor,
          opacity: swipeAbs > 10 ? 1 : 0
        }}
      >
        <div 
          className="swipe-icon-box"
          style={{ 
            left: swipeX > 0 ? '20px' : 'auto',
            right: swipeX < 0 ? '20px' : 'auto',
            transform: `scale(${Math.min(0.5 + opacity, 1.2)})`
          }}
        >
          {swipeIcon}
        </div>
      </div>

      <div 
        className="item-row-inner"
        style={{ 
          transform: `translateX(${swipeX}px) scale(${isMoving.current ? 1.02 : 1})`,
          boxShadow: isMoving.current ? '0 10px 25px rgba(0,0,0,0.1)' : undefined,
          transition: isMoving.current ? 'none' : 'all 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
          zIndex: isMoving.current ? 10 : 2
        }}
      >
        {!hideBullet && (
          <div className="cat-marker" style={{ backgroundColor: CAT_COLORS[item.cat] || 'transparent' }} />
        )}
        
        <div className="item-content-wrap" onClick={() => { !onRowClick && onToggle?.(item.id); }}>
          <div className="item-name-row">
            <div className="item-name">{item.name}</div>
            <div className="item-meta-tags">
              {item.kcal && (
                <div className="item-kcal-tag">🔥 {item.kcal}</div>
              )}
              {item.qty && (
                <div className="item-qty-pill-tag">{item.qty}</div>
              )}
            </div>
          </div>
          {item.notes && (
            <div className="item-notes-pill">{item.notes}</div>
          )}
        </div>

        <div className="item-right-wrap">
          <div className="item-options-btn" onClick={(e) => { e.stopPropagation(); onEdit?.(item); }}>
            ⋮
          </div>
        </div>
      </div>
    </div>
  );
}
