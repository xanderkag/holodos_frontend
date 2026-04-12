import Foundation

@MainActor
class DataService {
    static let shared = DataService()
    
    let categories = [
        "Овощи": "🥦", "Фрукты": "🍎", "Молочные продукты": "🥛", 
        "Яйца": "🥚", "Мясо и рыба": "🥩", "Птица": "🍗", 
        "Хлеб и выпечка": "🍞", "Бакалея": "🌾", "Заморозка": "❄️", 
        "Напитки": "🥤", "Для дома": "🧴", "Для животных": "🐾", "Другое": "📦"
    ]
    
    let dictionary: [String: String] = [
        "помидор": "Овощи", "томат": "Овощи", "огурец": "Овощи", "морковь": "Овощи", "картофель": "Овощи", "картошка": "Овощи",
        "яблоко": "Фрукты", "груша": "Фрукты", "банан": "Фрукты", "апельсин": "Фрукты",
        "молоко": "Молочные продукты", "кефир": "Молочные продукты", "сметана": "Молочные продукты", "сыр": "Молочные продукты",
        "яйцо": "Яйца", "яйца": "Яйца",
        "говядина": "Мясо и рыба", "свинина": "Мясо и рыба", "баранина": "Мясо и рыба", "фарш": "Мясо и рыба", "рыба": "Мясо и рыба",
        "курица": "Птица", "индейка": "Птица",
        "хлеб": "Хлеб и выпечка", "батон": "Хлеб и выпечка",
        "рис": "Бакалея", "гречка": "Бакалея", "макароны": "Бакалея", "паста": "Бакалея", "мука": "Бакалея",
        "пельмени": "Заморозка", "мороженое": "Заморозка",
        "вода": "Напитки", "сок": "Напитки", "чай": "Напитки", "кофе": "Напитки"
    ]

    func normalize(_ s: String) -> String {
        return s.trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: "ё", with: "е")
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
    }

    func classify(name: String) -> String {
        let n = normalize(name)
        if let cat = dictionary[n] { return cat }
        for (key, cat) in dictionary {
            if n.contains(key) || key.contains(n) { return cat }
        }
        return "Другое"
    }

    func parseIn(text: String) -> [Item] {
        let lines = text.components(separatedBy: CharacterSet(charactersIn: ",\n;"))
        return lines.compactMap { line -> Item? in
            let s = line.trimmingCharacters(in: .whitespacesAndNewlines)
            if s.isEmpty { return nil }
            
            var name = s
            var qty: String? = nil
            
            let pattern = "^(\\d+[a-zA-Zа-яА-Я]*)\\s+(.+)$|^(.+)\\s+(\\d+[a-zA-Zа-яА-Я]*)$"
            if let regex = try? NSRegularExpression(pattern: pattern) {
                let range = NSRange(location: 0, length: s.utf16.count)
                if let match = regex.firstMatch(in: s, range: range) {
                    if let qRange = Range(match.range(at: 1), in: s) ?? Range(match.range(at: 4), in: s),
                       let nRange = Range(match.range(at: 2), in: s) ?? Range(match.range(at: 3), in: s) {
                        qty = String(s[qRange])
                        name = String(s[nRange])
                    }
                }
            }
            
            return Item(id: UUID().uuidString, name: name.trimmingCharacters(in: .whitespaces), cat: classify(name: name), isChecked: false, qty: qty)
        }
    }

    func sumQuantities(_ q1: String?, _ q2: String?) -> String? {
        guard let q1 = q1, !q1.isEmpty else { return q2 }
        guard let q2 = q2, !q2.isEmpty else { return q1 }
        
        let parse = { (q: String) -> (val: Double, unit: String)? in
            let pattern = "^([\\d.,]+)\\s*(.*)$"
            if let regex = try? NSRegularExpression(pattern: pattern),
               let match = regex.firstMatch(in: q, range: NSRange(location: 0, length: q.utf16.count)) {
                let vRange = Range(match.range(at: 1), in: q)!
                let uRange = Range(match.range(at: 2), in: q)!
                let val = Double(q[vRange].replacingOccurrences(of: ",", with: ".")) ?? 0
                return (val, q[uRange].trimmingCharacters(in: .whitespaces).lowercased())
            }
            return nil
        }
        
        let a = parse(q1)
        let b = parse(q2)
        
        if let a = a, let b = b, a.unit == b.unit {
            let sum = (a.val + b.val * 100).rounded() / 100
            let sumStr = sum.truncatingRemainder(dividingBy: 1) == 0 ? String(format: "%.0f", sum) : String(sum)
            return "\(sumStr)\(a.unit.isEmpty ? "" : " " + a.unit)"
        }
        
        return "\(q1) + \(q2)"
    }

    func mergeItems(existing: [Item], newItems: [Item]) -> [Item] {
        var merged = existing
        for newItem in newItems {
            let targetName = newItem.name.lowercased().trimmingCharacters(in: .whitespaces)
            if let idx = merged.firstIndex(where: { $0.name.lowercased().trimmingCharacters(in: .whitespaces) == targetName }) {
                merged[idx].qty = sumQuantities(merged[idx].qty, newItem.qty)
                merged[idx].isChecked = false
            } else {
                merged.append(newItem)
            }
        }
        return merged
    }
}
