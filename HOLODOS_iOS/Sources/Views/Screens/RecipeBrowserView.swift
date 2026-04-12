import SwiftUI

struct RecipeBrowserView: View {
    @Bindable var viewModel: StoreViewModel
    @State private var recipeTab: RecipeTab = .online
    
    enum RecipeTab: String, CaseIterable, Identifiable {
        case my = "Мои"
        case online = "Онлайн"
        var id: Self { self }
    }
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("Категория", selection: $recipeTab) {
                    ForEach(RecipeTab.allCases) { tab in
                        Text(tab.rawValue).tag(tab)
                    }
                }
                .pickerStyle(.segmented)
                .padding()
                
                let currentRecipes = recipeTab == .my ? viewModel.recipes : Array(DataService.shared.recipesDB.values)
                
                if currentRecipes.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: recipeTab == .my ? "book.closed" : "globe")
                            .font(.system(size: 64))
                            .foregroundStyle(.gray.opacity(0.3))
                        Text(recipeTab == .my ? "У вас пока нет своих рецептов" : "Рецепты не найдены")
                            .font(.headline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(currentRecipes.sorted(by: { $0.name < $1.name })) { recipe in
                            RecipeRowView(recipe: recipe, isMyRecipe: recipeTab == .my, viewModel: viewModel)
                                .listRowBackground(Color.clear)
                                .listRowSeparator(.hidden)
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle(recipeTab == .my ? "Мои рецепты" : "Рецепты онлайн")
            .toolbar {
                if recipeTab == .my {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            // Logic for creating new recipe
                        } label: {
                            Image(systemName: "plus")
                        }
                    }
                }
            }
        }
    }
}

struct RecipeRowView: View {
    let recipe: Recipe
    let isMyRecipe: Bool
    @Bindable var viewModel: StoreViewModel
    @State private var isExpanded = false
    
    var body: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text(recipe.emoji)
                        .font(.largeTitle)
                    VStack(alignment: .leading) {
                        Text(recipe.name)
                            .font(.headline)
                        Text("\(recipe.variants[0].ingredients.count) ингредиентов")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .foregroundStyle(.secondary)
                }
                .contentShape(Rectangle())
                .onTapGesture {
                    withAnimation(.spring()) {
                        isExpanded.toggle()
                    }
                }
                
                if isExpanded {
                    VStack(alignment: .leading, spacing: 8) {
                        Divider()
                        
                        ForEach(recipe.variants[0].ingredients, id: \.name) { ing in
                            HStack {
                                Text(ing.name)
                                    .font(.subheadline)
                                Spacer()
                                Text(ing.quantity)
                                    .font(.caption.bold())
                                    .foregroundStyle(.secondary)
                            }
                        }
                        
                        HStack(spacing: 12) {
                            Button("Всё в список") {
                                // Logic to add all ingredients
                            }
                            .buttonStyle(.borderedProminent)
                            .controlSize(.small)
                            
                            if !isMyRecipe {
                                Button("В мои") {
                                    viewModel.saveRecipe(recipe)
                                }
                                .buttonStyle(.bordered)
                                .controlSize(.small)
                            } else {
                                Button("Удалить", role: .destructive) {
                                    viewModel.deleteRecipe(name: recipe.name)
                                }
                                .buttonStyle(.bordered)
                                .controlSize(.small)
                            }
                        }
                        .padding(.top, 8)
                    }
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
        }
    }
}

// Extension to DataService for recipesDB
extension DataService {
    var recipesDB: [String: Recipe] {
        // Simple mapping of RECIPES_DB from React
        return [
            "карбонара": Recipe(name: "Карбонара", emoji: "🍝", portions: 2, variants: [
                RecipeVariant(label: "Классическая", ingredients: [
                    Ingredient(name: "спагетти", quantity: "200 г", category: "Бакалея"),
                    Ingredient(name: "гуанчале", quantity: "100 г", category: "Мясо и рыба")
                ])
            ])
            // ... (can be extended similarly to TS RECIPES_DB)
        ]
    }
}
