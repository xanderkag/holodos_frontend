import { useState, useMemo } from 'react';
import type { Item, Recipe, Category, Ingredient } from '../types';
import { GROUP_ORDER, uid, ONLINE_RECIPES } from '../utils/data';
import { showToast } from '../components/Toast';
import CategoryBlock from '../components/CategoryBlock';
import ItemRow from '../components/ItemRow';
import { EditItemModal } from '../components/EditItemModal';
import { EditRecipeModal } from '../components/EditRecipeModal';
import { RecipesView } from './Baseline/RecipesView';
import { SubHeader } from '../components/SubHeader';
import { useData } from '../context/DataContext';
import { decrementQty } from '../utils/data';
import './BaselineScreen.css';

interface BaselineScreenProps {
  stock: Item[];
  setStock: React.Dispatch<React.SetStateAction<Item[]>>;
  baseline: Item[];
  setBaseline: React.Dispatch<React.SetStateAction<Item[]>>;
  myRecipes: Recipe[];
  setMyRecipes: React.Dispatch<React.SetStateAction<Recipe[]>>;
  toList: (item: Item) => void;
  mode: 'stock' | 'base' | 'recipes';
  setMode: (mode: 'stock' | 'base' | 'recipes') => void;
  onEat?: (item: Item) => void;
}

export default function BaselineScreen({ stock, setStock, baseline, setBaseline, myRecipes, setMyRecipes, toList, mode, setMode, onEat }: BaselineScreenProps) {
  const { addSystemMessage, addLogEvent } = useData();
  const [expandedRecipe, setExpandedRecipe] = useState<string | null>(null);
  
  const [recipesTab, setRecipesTab] = useState<'my' | 'online'>('my');
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [editMode, setEditMode] = useState<'tovar' | 'dnevnik'>('tovar');
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [editingRecipeIngredient, setEditingRecipeIngredient] = useState<{ recipeId: string, variantIdx: number, ingredientIdx: number, ingredient: Ingredient } | null>(null);

  const activeState = mode === 'stock' ? stock : baseline;
  const setActiveState = mode === 'stock' ? setStock : setBaseline;

  const currentRecipes = recipesTab === 'my' ? myRecipes : ONLINE_RECIPES;

  const groups = useMemo(() => {
    const g: Record<string, Item[]> = {};
    activeState.forEach(i => {
      if (!g[i.cat]) g[i.cat] = [];
      g[i.cat].push(i);
    });
    return g;
  }, [activeState]);

  const sortedCats = useMemo(() => {
    return Object.keys(groups).sort((a, b) => {
      const ia = GROUP_ORDER.indexOf(a);
      const ib = GROUP_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [groups]);

  const handleDelete = (id: string) => {
    const item = activeState.find(i => i.id === id);
    setActiveState(p => p.filter(i => i.id !== id));
    showToast(`Удалено из ${mode === 'stock' ? 'Холодоса' : 'Любимых'}`);
    if (item) {
      addSystemMessage(`Удалено из ${mode === 'stock' ? 'Холодоса' : 'Любимого'}: ${item.name}`);
      addLogEvent(`Удалено из ${mode === 'stock' ? 'Холодоса' : 'Любимых'}: "${item.name}"`, 'remove');
    }
  };

  const handleUpdate = (id: string, updates: Partial<Item>) => {
    const item = activeState.find(i => i.id === id);
    setActiveState(p => p.map(i => i.id === id ? { ...i, ...updates } : i));
    if (item && updates.name && updates.name !== item.name) {
      addSystemMessage(`Переименовано: ${item.name} → ${updates.name}`);
    }
  };

  const sanitizeItem = (it: Item): Item => ({
    ...it,
    id: it.id || String(Date.now()),
    name: it.name || 'Без названия',
    qty: it.qty || '',
    cat: it.cat || 'Другое',
    notes: it.notes || '',
    kcal: it.kcal || undefined,
    protein: it.protein || undefined,
    fat: it.fat || undefined,
    carbs: it.carbs || undefined
  });

  const openEditModal = (it: Item, emode: 'tovar' | 'dnevnik' = 'tovar') => {
    setEditMode(emode);
    setEditingItem(sanitizeItem(it));
  };

  const handleEditSave = (name: string, qty: string, cat: Category, notes: string, kcal?: number, protein?: number, fat?: number, carbs?: number) => {
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

  const saveToMyRecipes = (r: Recipe) => {
    const exists = myRecipes.some(m => m.name.toLowerCase() === r.name.toLowerCase());
    if (exists) {
      showToast('Рецепт уже есть в ваших сохраненных');
      return;
    }
    const newRecipe = { ...r, id: uid() };
    setMyRecipes(p => [...p, newRecipe]);
    setRecipesTab('my');
    setExpandedRecipe(newRecipe.id);
    showToast(`+ ${r.name} в Мои рецепты`);
  };

  const handleDeleteRecipe = (id: string, name: string) => {
    if (window.confirm(`Удалить рецепт "${name}"?`)) {
      setMyRecipes(p => p.filter(r => r.id !== id));
      showToast(`Рецепт "${name}" удален`);
    }
  };

  const handleUpdateRecipeMetadata = (name: string, emoji: string) => {
    if (editingRecipe) {
      setMyRecipes(p => p.map(r => r.id === editingRecipe.id ? { ...r, name, emoji } : r));
      setEditingRecipe(null);
      showToast('Рецепт обновлен');
    }
  };

  const handleEditIngredientInRecipe = (recipeId: string, vidx: number, gidx: number, name: string, qty: string, cat: Category, notes: string, kcal?: number, protein?: number, fat?: number, carbs?: number) => {
    setMyRecipes(p => p.map(r => {
      if (r.id !== recipeId) return r;
      const newVariants = [...r.variants];
      newVariants[vidx].ingredients[gidx] = { name, quantity: qty, category: cat, notes, kcal, protein, fat, carbs };
      return { ...r, variants: newVariants };
    }));
    setEditingRecipeIngredient(null);
    showToast('Ингредиент обновлен');
  };

  const handleDeleteIngredientInRecipe = (recipeId: string, vidx: number, gidx: number) => {
    setMyRecipes(p => p.map(r => {
      if (r.id !== recipeId) return r;
      const newVariants = [...r.variants];
      newVariants[vidx].ingredients.splice(gidx, 1);
      return { ...r, variants: newVariants };
    }));
    showToast('Ингредиент удален из рецепта');
  };

  const handleClearEverything = () => {
    const targetName = mode === 'stock' ? 'Холодильник' : 'Любимые';
    if (window.confirm(`Вы точно хотите полностью очистить ${targetName}?`)) {
      setActiveState([]);
      const logText = `${targetName} полностью очищен`;
      addSystemMessage(logText);
      addLogEvent(logText, 'remove');
      showToast(`🧹 ${targetName} пуст`);
    }
  };


  return (
    <div className="screen baseline-screen">
      <SubHeader>
        <div className="ui-capsule">
          <button 
            className={`ui-pill ${mode === 'stock' ? 'active' : ''}`} 
            onClick={() => setMode('stock')}
          >
            HOLODOS
          </button>
          <button 
            className={`ui-pill ${mode === 'base' ? 'active' : ''}`} 
            onClick={() => setMode('base')}
          >
            Любимое
          </button>
          <button 
            className={`ui-pill ${mode === 'recipes' ? 'active' : ''}`} 
            onClick={() => setMode('recipes')}
          >
            Рецепты
          </button>
        </div>
      </SubHeader>


      <div className="bl-content">
        {mode === 'recipes' && (
          <div className="bl-subtabs animated-pop">
            <div className="bl-st-left">
              <button className={`bl-subtab ${recipesTab === 'my' ? 'active' : ''}`} onClick={() => { setRecipesTab('my'); setExpandedRecipe(null); }}>Мои</button>
              <button className={`bl-subtab ${recipesTab === 'online' ? 'active' : ''}`} onClick={() => { setRecipesTab('online'); setExpandedRecipe(null); }}>Онлайн</button>
            </div>
            {recipesTab === 'my' && (
              <button className="bl-st-add" onClick={() => showToast('Создание рецепта скоро появится')}>+</button>
            )}
          </div>
        )}

        {mode !== 'recipes' ? (
          <>
            {mode === 'base' && baseline.length > 0 && (
              <div className="bl-base-actions animated-pop">
                <button className="bl-act-btn glass-panel" onClick={() => {
                  baseline.forEach(i => toList(i));
                  showToast(`+ ${baseline.length} в Покупки`);
                  addLogEvent(`В список добавлено ${baseline.length} Любимых товаров`, 'add');
                }}>Добавить всё</button>
                <button className="bl-act-btn glass-panel acc" onClick={() => {
                  const missing = baseline.filter(bk => !stock.some(sk => sk.name.toLowerCase() === bk.name.toLowerCase()));
                  missing.forEach(i => toList(i));
                  showToast(missing.length > 0 ? `+ ${missing.length} недостающих` : 'Всё уже есть в наличии!');
                }}>Добавить недостающее</button>
              </div>
            )}

            {sortedCats.length === 0 && (
              <div className="empty" style={{ padding: '60px 0' }}>
                <div className="empty-icon" style={{ opacity: 0.3, filter: 'grayscale(1)' }}>🧊</div>
                <div className="empty-text">Здесь пока пусто.</div>
              </div>
            )}
            {sortedCats.map(cat => (
              <CategoryBlock 
                key={cat} 
                cat={cat} 
                count={groups[cat].length}
              >
                {groups[cat].map(item => (
                  <ItemRow 
                    key={item.id} 
                    item={item} 
                    onRowClick={mode === 'stock' ? (() => openEditModal(item, 'tovar')) : (mode === 'base' ? (() => toList(item)) : undefined)}
                    onSwipeRight={mode === 'stock' ? onEat : toList}
                    onSwipeLeft={() => handleDelete(item.id)}
                    swipeRightIcon={mode === 'stock' ? "📓" : "➕"}
                    swipeRightColor={mode === 'stock' ? "rgba(88, 86, 214, opacity)" : undefined}
                    swipeLeftIcon="✕"
                    onLongPress={mode === 'stock' ? onEat : undefined}
                    onEdit={(it) => openEditModal(it, 'tovar')}
                    onDelete={() => handleDelete(item.id)}
                    hideBullet={mode === 'base'}
                  />

                ))}
              </CategoryBlock>
            ))}
          </>
        ) : (
          <RecipesView
            currentRecipes={currentRecipes}
            recipesTab={recipesTab}
            expandedRecipe={expandedRecipe}
            setExpandedRecipe={setExpandedRecipe}
            stock={stock}
            setEditingRecipe={setEditingRecipe}
            handleDeleteRecipe={handleDeleteRecipe}
            setEditingRecipeIngredient={setEditingRecipeIngredient}
            handleDeleteIngredientInRecipe={handleDeleteIngredientInRecipe}
            toList={toList}
            saveToMyRecipes={saveToMyRecipes}
          />
        )}
      </div>

      {mode !== 'recipes' && activeState.length > 0 && (
        <div className="list-footer-actions animated-fade-in">
          <button className="clear-all-btn" onClick={handleClearEverything}>
            Очистить {mode === 'stock' ? 'Холодос' : 'Любимое'} полностью
          </button>
        </div>
      )}

      {/* --- Universal Edit Modal (Safe Schema v2.6.8 - The Isolation Build) --- */}
      { (editingItem || editingRecipeIngredient) && (
        <EditItemModal 
          key={editingItem?.id || editingRecipeIngredient?.ingredient.name || 'open'}
          isOpen={true}
          onClose={() => { setEditingItem(null); setEditingRecipeIngredient(null); }}
          initialName={editingItem ? (editingItem.name || '') : (editingRecipeIngredient?.ingredient.name || '')}
          initialQty={editingItem ? (editingItem.qty || '') : (editingRecipeIngredient?.ingredient.quantity || '')}
          initialCat={(editingItem ? editingItem.cat : (editingRecipeIngredient?.ingredient.category || 'Другое')) as Category}
          initialNotes={editingItem ? editingItem.notes : (editingRecipeIngredient?.ingredient.notes || '')}
          initialKcal={editingItem ? editingItem.kcal : editingRecipeIngredient?.ingredient.kcal}
          initialProtein={editingItem ? editingItem.protein : editingRecipeIngredient?.ingredient.protein}
          initialFat={editingItem ? editingItem.fat : editingRecipeIngredient?.ingredient.fat}
          initialCarbs={editingItem ? editingItem.carbs : editingRecipeIngredient?.ingredient.carbs}
          onSave={(name, qty, cat, notes, kcal, protein, fat, carbs) => {
            if (editingItem) handleEditSave(name, qty, cat, notes, kcal, protein, fat, carbs);
            else if (editingRecipeIngredient) {
              handleEditIngredientInRecipe(
                editingRecipeIngredient.recipeId, 
                editingRecipeIngredient.variantIdx, 
                editingRecipeIngredient.ingredientIdx, 
                name, qty, cat, notes,
                kcal, protein, fat, carbs
              );
            }
          }}
          onDelete={() => {
            if (editingItem) handleEditDelete();
            else if (editingRecipeIngredient) {
              handleDeleteIngredientInRecipe(
                editingRecipeIngredient.recipeId, 
                editingRecipeIngredient.variantIdx, 
                editingRecipeIngredient.ingredientIdx
              );
              setEditingRecipeIngredient(null);
            }
          }}
          onLogDiary={(diaryData) => {
            if (editingItem && onEat) {
               const customEntry = {
                 ...editingItem,
                 qty: `${diaryData.portionQty} ${diaryData.portionUnit}`,
                 kcal: diaryData.kcal,
                 protein: diaryData.protein,
                 fat: diaryData.fat,
                 carbs: diaryData.carbs,
                 consumedAt: diaryData.consumedAt,
               };
               // Passing custom item and specific meal type to handleAddToDiary
               (onEat as any)(customEntry, diaryData.mealType);
               
               if (diaryData.deductFromStock && mode === 'stock') {
                 const newQty = decrementQty(editingItem.qty || '', diaryData.portionQty, diaryData.portionUnit);
                 
                 if (newQty === null) {
                   handleDelete(editingItem.id);
                 } else {
                   handleUpdate(editingItem.id, { qty: newQty });
                 }
               }
               
               addLogEvent(`Съедено: "${editingItem.name}" (${diaryData.portionQty} ${diaryData.portionUnit})`, 'log');
               setEditingItem(null);
            }
          }}
          initialMode={editMode}
        />
      )}

      <EditRecipeModal 
        isOpen={!!editingRecipe}
        onClose={() => setEditingRecipe(null)}
        initialName={editingRecipe?.name || ''}
        initialEmoji={editingRecipe?.emoji || ''}
        onSave={handleUpdateRecipeMetadata}
      />
      
      <div style={{ height: 100 }} />
    </div>
  );
}
