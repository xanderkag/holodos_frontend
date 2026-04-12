import React from 'react';
import type { Recipe, Item, Ingredient } from '../../types';
import ItemRow from '../../components/ItemRow';
import { uid } from '../../utils/data';
import { showToast } from '../../components/Toast';

interface RecipesViewProps {
  currentRecipes: Recipe[];
  recipesTab: 'my' | 'online';
  expandedRecipe: string | null;
  setExpandedRecipe: (id: string | null) => void;
  stock: Item[];
  setEditingRecipe: (r: Recipe) => void;
  handleDeleteRecipe: (id: string, name: string) => void;
  setEditingRecipeIngredient: (info: { recipeId: string, variantIdx: number, ingredientIdx: number, ingredient: Ingredient }) => void;
  handleDeleteIngredientInRecipe: (recipeId: string, variantIdx: number, ingredientIdx: number) => void;
  toList: (item: Item) => void;
  saveToMyRecipes: (r: Recipe) => void;
}

export const RecipesView: React.FC<RecipesViewProps> = ({
  currentRecipes, recipesTab, expandedRecipe, setExpandedRecipe, stock,
  setEditingRecipe, handleDeleteRecipe,
  setEditingRecipeIngredient, handleDeleteIngredientInRecipe,
  toList, saveToMyRecipes
}) => {
  return (
    <div className="recipes-list">
      {currentRecipes.length === 0 && (
        <div className="empty" style={{ padding: '60px 0' }}>
          <div className="empty-icon" style={{ opacity: 0.3, filter: 'grayscale(1)' }}>🥘</div>
          <div className="empty-text">Список пуст. Выбирайте рецепты из онлайна.</div>
        </div>
      )}
      {currentRecipes.map(r => (
        <div key={r.id} className="r-item-card glass-panel">
          <div className="r-item-header" onClick={() => setExpandedRecipe(expandedRecipe === r.id ? null : r.id)}>
            <div className="ric-emoji-box">{r.emoji}</div>
            <div className="ric-info" onClick={() => setExpandedRecipe(expandedRecipe === r.id ? null : r.id)}>
              <div className="ric-name">{r.name.toUpperCase()}</div>
              <div className="ric-meta">{r.variants[0].ingredients.length} ингредиентов</div>
            </div>
            
            {recipesTab === 'my' && (
              <div className="ric-actions">
                <button className="ric-btn-mini" onClick={(e) => { e.stopPropagation(); setEditingRecipe(r); }}>✎</button>
                <button className="ric-btn-mini del" onClick={(e) => { e.stopPropagation(); handleDeleteRecipe(r.id, r.name); }}>✕</button>
              </div>
            )}

            <div className={`ric-arrow ${expandedRecipe === r.id ? 'up' : ''}`} onClick={() => setExpandedRecipe(expandedRecipe === r.id ? null : r.id)}>↓</div>
          </div>
            
          {expandedRecipe === r.id && (
            <div className="ric-body animated-slide-down">
              {r.variants.map((v, vidx) => (
                <div key={vidx} className="r-variant">
                  <div className="rv-label">{v.label}</div>
                  <div className="rv-ings">
                    {v.ingredients.map((g, gidx) => (
                      <ItemRow 
                        key={gidx} 
                        item={{ 
                          id: String(gidx), 
                          name: g.name, 
                          qty: g.quantity, 
                          cat: g.category || '', 
                          isChecked: false,
                          kcal: g.kcal,
                          protein: g.protein,
                          fat: g.fat,
                          carbs: g.carbs
                        }} 
                        onRowClick={() => {
                          const it: Item = { 
                            id: uid(), 
                            name: g.name, 
                            qty: g.quantity, 
                            cat: g.category || 'Другое', 
                            isChecked: false,
                            kcal: g.kcal,
                            protein: g.protein,
                            fat: g.fat,
                            carbs: g.carbs
                          };
                          toList(it);
                        }}
                        onEdit={recipesTab === 'my' ? () => setEditingRecipeIngredient({ recipeId: r.id, variantIdx: vidx, ingredientIdx: gidx, ingredient: g }) : undefined}
                        onDelete={recipesTab === 'my' ? () => handleDeleteIngredientInRecipe(r.id, vidx, gidx) : undefined}
                        hideBullet
                      />
                    ))}
                  </div>
                  
                  <div className="rv-actions-row">
                    <button className="rv-act-btn glass-panel" onClick={(e) => {
                      e.stopPropagation();
                      v.ingredients.forEach(g => {
                        toList({ id: uid(), name: g.name, qty: g.quantity, cat: g.category || 'Другое', isChecked: false, kcal: g.kcal, protein: g.protein, fat: g.fat, carbs: g.carbs });
                      });
                      showToast(`+ ${v.ingredients.length} в Покупки`);
                    }}>Всё в список</button>
                    
                    <button className="rv-act-btn glass-panel acc" onClick={(e) => {
                      e.stopPropagation();
                      const missing = v.ingredients.filter(g => !stock.some(s => s.name.toLowerCase() === g.name.toLowerCase()));
                      missing.forEach(g => {
                        toList({ id: uid(), name: g.name, qty: g.quantity, cat: g.category || 'Другое', isChecked: false, kcal: g.kcal, protein: g.protein, fat: g.fat, carbs: g.carbs });
                      });
                      showToast(missing.length > 0 ? `+ ${missing.length} недостающих` : 'Всё есть в наличии!');
                    }}>Недостающее</button>
                    
                    {recipesTab === 'online' ? (
                      <button className="rv-act-btn glass-panel" onClick={(e) => {
                        e.stopPropagation();
                        saveToMyRecipes(r);
                      }}>В мои рецепты</button>
                    ) : (
                      <button className="rv-act-btn glass-panel" onClick={(e) => {
                        e.stopPropagation();
                        showToast('Скоро: Поделиться рецептом');
                      }}>Поделиться</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
