import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  TouchSensor,
  rectIntersection,
  type CollisionDetection,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToFirstScrollableAncestor, restrictToVerticalAxis } from '@dnd-kit/modifiers';

import type { Item, Category } from '../types';
import ItemRow from '../components/ItemRow';
import CategoryBlock from '../components/CategoryBlock';
import { EditItemModal } from '../components/EditItemModal';
import { SubHeader } from '../components/SubHeader';
import { showToast } from '../components/Toast';
import { useData } from '../context/DataContext';
import { PurchaseProgressBar } from '../components/PurchaseProgressBar';
import './ListScreen.css';

import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';

interface ListScreenProps {
  list: Item[];
  setList: React.Dispatch<React.SetStateAction<Item[]>>;
  toStock?: (item: Item) => void;
  categoryOrder: Category[];
  setCategoryOrder: (newOrder: Category[]) => void;
}

export default function ListScreen({ list, setList, toStock, categoryOrder, setCategoryOrder }: ListScreenProps) {
  const { addSystemMessage, addLogEvent } = useData();
  const [showChecked, setShowChecked] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  
  // v2.7.1: Finish shopping logic
  const handleFinishShopping = () => {
    const purchased = list.filter(i => i.isChecked);
    if (purchased.length === 0) {
      showToast("🛒 Выберите товары для переноса");
      return;
    }

    if (purchased.length > 3 && !window.confirm(`Перенести ${purchased.length} товаров в Холодос?`)) {
      return;
    }
    
    // 1. Move to stock
    if (toStock) {
      purchased.forEach(it => toStock({ ...it, isChecked: false }));
    }
    
    // 2. Remove from list
    setList(prev => prev.filter(i => !i.isChecked));
    showToast(`🧊 В Холодосе пополнение: ${purchased.length}`);
    addSystemMessage(`Куплено: ${purchased.map(p => p.name).join(', ')}`);
    addLogEvent(`Куплено: ${purchased.map(p => p.name).join(', ')}`, 'move');
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeItems = useMemo(() => list.filter(i => !i.isChecked), [list]);
  const checkedItems = useMemo(() => list.filter(i => i.isChecked), [list]);

  const groups = useMemo(() => {
    const g: Record<string, Item[]> = {};
    activeItems.forEach(i => {
      if (!g[i.cat]) g[i.cat] = [];
      g[i.cat].push(i);
    });
    return g;
  }, [activeItems]);

  const sortedCats = useMemo(() => {
    const existingCats = Object.keys(groups);
    const order = [...categoryOrder];
    existingCats.forEach(c => {
      if (!order.includes(c)) order.push(c);
    });
    return order.filter(c => existingCats.includes(c));
  }, [groups, categoryOrder]);

  // Custom collision detection with a stabilization threshold
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    const collisions = rectIntersection(args);
    if (collisions.length === 0) return closestCorners(args);

    const activeRect = args.active.rect.current.translated;
    if (!activeRect) return collisions;

    // Filter collisions to only those that cross a significant threshold (25% of height)
    return collisions.filter((collision) => {
      const { data } = collision;
      if (!data || !data.droppableContainer) return false;
      
      const targetRect = data.droppableContainer.rect.current;
      if (!targetRect) return false;

      const intersectionHeight = Math.min(activeRect.top + activeRect.height, targetRect.top + targetRect.height) - 
                                 Math.max(activeRect.top, targetRect.top);
      
      // Require at least 25% of the target height to be overlapped for a swap
      return intersectionHeight > targetRect.height * 0.25;
    });
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = categoryOrder.indexOf(active.id as string);
      const newIndex = categoryOrder.indexOf(over.id as string);
      const newOrder = arrayMove(categoryOrder, oldIndex, newIndex);
      setCategoryOrder(newOrder);
    }
  };

  // ... rest of the helper functions (toggleCheck, handleUpdate, handleDelete, etc.)
  const toggleCheck = (id: string) => {
    setList(p => p.map(i => i.id === id ? { ...i, isChecked: !i.isChecked } : i));
  };

  const handleUpdate = (id: string, updates: Partial<Item>) => {
    setList(p => p.map(i => i.id === id ? { ...i, ...updates } : i));
  };

  const handleDelete = (id: string) => {
    const it = list.find(i => i.id === id);
    setList(p => p.filter(i => !i.id || i.id !== id));
    if (it) {
      addSystemMessage(`Удалено из покупок: ${it.name}`);
      addLogEvent(`Удалено из покупок: "${it.name}"`, 'remove');
    }
  };

  const handleEditSave = (
    name: string, 
    qty: string, 
    cat: Category, 
    notes: string, 
    kcal?: number, 
    protein?: number, 
    fat?: number, 
    carbs?: number
  ) => {
    if (editingItem) {
      handleUpdate(editingItem.id, { name, qty, cat, notes, kcal, protein, fat, carbs });
      setEditingItem(null);
    }
  };

  const handleEditDelete = () => {
    if (editingItem) {
      handleDelete(editingItem.id);
      setEditingItem(null);
    }
  };


  return (
    <div className="screen list-screen">
      <SubHeader>
        <PurchaseProgressBar 
          purchasedCount={checkedItems.length}
          totalCount={list.length}
          onFinish={handleFinishShopping}
        />
      </SubHeader>

      <div className="list-groups">
        {sortedCats.length === 0 && activeItems.length === 0 && (
          <div className="empty">
            <div className="empty-icon">🛒</div>
            <div className="empty-text">Список пуст.<br/>Добавьте продукты ниже.</div>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={customCollisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
        >
          <SortableContext items={sortedCats} strategy={verticalListSortingStrategy}>
            {sortedCats.map(cat => (
              <CategoryBlock 
                key={cat} 
                cat={cat} 
                count={groups[cat].length}
                isDragging={activeId === cat}
              >
                {groups[cat].map((item, idx) => (
                  <ItemRow 
                    key={item.id} 
                    item={item} 
                    onSwipeRight={() => toggleCheck(item.id)}
                    onSwipeLeft={() => handleDelete(item.id)}
                    onDelete={handleDelete}
                    onEdit={setEditingItem}
                    onToggle={toggleCheck}
                    swipeRightIcon="✅"
                    swipeLeftIcon="✕"
                    isFirstInCategory={idx === 0}
                    isLastInCategory={idx === groups[cat].length - 1}
                  />
                ))}
              </CategoryBlock>
            ))}
          </SortableContext>
          <DragOverlay 
            zIndex={10000}
            dropAnimation={{
              duration: 250,
              easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
              sideEffects: defaultDropAnimationSideEffects({
                styles: {
                  active: {
                    opacity: '0.4',
                  },
                },
              }),
            }}
          >
            {activeId ? (
              <div style={{ pointerEvents: 'none', width: '100%', touchAction: 'none' }}>
                <CategoryBlock 
                  cat={activeId} 
                  count={groups[activeId]?.length || 0}
                  isOverlay
                >
                  {groups[activeId]?.map((item, idx) => (
                    <ItemRow 
                      key={item.id} 
                      item={item} 
                      isFirstInCategory={idx === 0}
                      isLastInCategory={idx === groups[activeId].length - 1}
                    />
                  ))}
                </CategoryBlock>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {checkedItems.length > 0 && (
          <div className="checked-sect">
            <div className="chkdiv" onClick={() => setShowChecked(!showChecked)}>
              <span className="chklbl">Куплено <span className="chkcnt">{checkedItems.length}</span></span>
              <div className="chkline" />
              <div className={`chkarr ${showChecked ? 'open' : ''}`}>▼</div>
            </div>
            
            <div className={`chkbody ${showChecked ? 'open' : ''}`}>
              <div className="cb-capsule chk-capsule">
                {checkedItems.map(item => (
                  <ItemRow 
                    key={item.id} 
                    item={item} 
                    onSwipeRight={() => toggleCheck(item.id)}
                    onSwipeLeft={() => handleDelete(item.id)}
                    onDelete={handleDelete}
                    onEdit={setEditingItem}
                    onToggle={toggleCheck}
                    swipeRightIcon="⭕"
                    swipeLeftIcon="✕"
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="list-footer-actions">
          <button className="clear-all-btn" onClick={() => {
            if (window.confirm('Вы точно хотите полностью очистить список покупок?')) {
              setList([]);
              addSystemMessage('Список покупок полностью очищен');
              addLogEvent('Список покупок очищен', 'remove');
            }
          }}>Очистить список полностью</button>
        </div>
      </div>

      <EditItemModal 
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        initialName={editingItem?.name || ''}
        initialQty={editingItem?.qty || ''}
        initialCat={editingItem?.cat || ''}
        initialNotes={editingItem?.notes || ''}
        initialKcal={editingItem?.kcal}
        initialProtein={editingItem?.protein}
        initialFat={editingItem?.fat}
        initialCarbs={editingItem?.carbs}
        onSave={handleEditSave}
        onDelete={handleEditDelete}
      />
    </div>
  );
}
