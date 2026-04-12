import Foundation
import Combine

@MainActor
@Observable
class StoreViewModel {
    var firebaseManager = FirebaseManager.shared
    
    // Shortcuts for convenience
    var shoppingList: [Item] { firebaseManager.appData?.list ?? [] }
    var stock: [Item] { firebaseManager.appData?.stock ?? [] }
    var base: [Item] { firebaseManager.appData?.base ?? [] }
    var recipes: [Recipe] { firebaseManager.appData?.recipes ?? [] }
    
    // MARK: - List Actions
    
    func addItemToList(_ text: String) {
        let newItems = DataService.shared.parseIn(text: text)
        let merged = DataService.shared.mergeItems(existing: shoppingList, newItems: newItems)
        firebaseManager.updateField("list", value: merged)
    }
    
    func toggleCheck(id: String) {
        var list = shoppingList
        if let idx = list.firstIndex(where: { $0.id == id }) {
            list[idx].isChecked?.toggle()
            firebaseManager.updateField("list", value: list)
        }
    }
    
    func deleteFromList(id: String) {
        let updated = shoppingList.filter { $0.id != id }
        firebaseManager.updateField("list", value: updated)
    }
    
    func updateItemInList(id: String, name: String, qty: String?) {
        var list = shoppingList
        if let idx = list.firstIndex(where: { $0.id == id }) {
            list[idx].name = name
            list[idx].qty = qty
            firebaseManager.updateField("list", value: list)
        }
    }
    
    // MARK: - Fridge/Base Actions
    
    func addItemToStock(_ text: String) {
        let newItems = DataService.shared.parseIn(text: text)
        let merged = DataService.shared.mergeItems(existing: stock, newItems: newItems)
        firebaseManager.updateField("stock", value: merged)
    }
    
    func deleteFromStock(id: String) {
        let updated = stock.filter { $0.id != id }
        firebaseManager.updateField("stock", value: updated)
    }
    
    func addItemToBase(_ text: String) {
        let newItems = DataService.shared.parseIn(text: text)
        let merged = DataService.shared.mergeItems(existing: base, newItems: newItems)
        firebaseManager.updateField("base", value: merged)
    }
    
    func deleteFromBase(id: String) {
        let updated = base.filter { $0.id != id }
        firebaseManager.updateField("base", value: updated)
    }
    
    func moveBaseToShoppingList() {
        // Logic to add missing base items to list
        let stockNames = Set(stock.map { $0.name.lowercased() })
        let listNames = Set(shoppingList.map { $0.name.lowercased() })
        
        let missing = base.filter { 
            !stockNames.contains($0.name.lowercased()) && 
            !listNames.contains($0.name.lowercased()) 
        }
        
        if !missing.isEmpty {
            let merged = DataService.shared.mergeItems(existing: shoppingList, newItems: missing)
            firebaseManager.updateField("list", value: merged)
        }
    }
    
    // MARK: - Recipe Actions
    
    func saveRecipe(_ recipe: Recipe) {
        var current = recipes
        if let idx = current.firstIndex(where: { $0.name == recipe.name }) {
            current[idx] = recipe
        } else {
            current.append(recipe)
        }
        firebaseManager.updateField("recipes", value: current)
    }
    
    func deleteRecipe(name: String) {
        let updated = recipes.filter { $0.name != name }
        firebaseManager.updateField("recipes", value: updated)
    }
}
