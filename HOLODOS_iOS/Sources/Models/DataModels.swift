import Foundation

struct Item: Identifiable, Codable, Equatable {
    var id: String
    var name: String
    var cat: String
    var isChecked: Bool? = false
    var qty: String?
    
    // For SwiftUI Lists
    static func == (lhs: Item, rhs: Item) -> Bool {
        return lhs.id == rhs.id && 
               lhs.name == rhs.name && 
               lhs.isChecked == rhs.isChecked && 
               lhs.qty == rhs.qty
    }
}

struct Ingredient: Codable, Equatable {
    var name: String
    var quantity: String
    var category: String
}

struct RecipeVariant: Codable, Equatable {
    var label: String
    var ingredients: [Ingredient]
}

struct Recipe: Identifiable, Codable, Equatable {
    var id: String { name } // Using name as ID like in baseline
    var name: String
    var emoji: String
    var portions: Int
    var variants: [RecipeVariant]
}

struct AppData: Codable {
    var list: [Item]
    var base: [Item]
    var stock: [Item]
    var recipes: [Recipe]
    var stores: [[String: String]]?
    var ords: [String: [String]]?
}
