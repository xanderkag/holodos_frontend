import SwiftUI

struct GlassCard<Content: View>: View {
    var content: Content
    
    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    var body: some View {
        content
            .padding()
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(.white.opacity(0.4), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.05), radius: 10, x: 0, y: 5)
    }
}

struct ItemRowView: View {
    let item: Item
    var onToggle: () -> Void
    var onDelete: () -> Void
    var onEdit: () -> Void
    var hideCheckbox: Bool = false
    
    var body: some View {
        HStack(spacing: 12) {
            if !hideCheckbox {
                Button(action: onToggle) {
                    Image(systemName: (item.isChecked ?? false) ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 24, weight: .medium))
                        .foregroundStyle((item.isChecked ?? false) ? .green : .gray.opacity(0.5))
                }
            } else {
                Text("•")
                    .font(.title2)
                    .foregroundStyle(.gray.opacity(0.3))
                    .padding(.leading, 8)
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text(item.name)
                    .font(.system(size: 16, weight: .semibold))
                    .strikethrough(item.isChecked ?? false)
                    .foregroundStyle((item.isChecked ?? false) ? .secondary : .primary)
                
                if let cat = DataService.shared.categories[item.cat] {
                    Text("\(cat) \(item.cat)")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(.gray.opacity(0.1))
                        .clipShape(Capsule())
                }
            }
            
            Spacer()
            
            if let qty = item.qty {
                Text(qty)
                    .font(.system(size: 13, weight: .bold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(.gray.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 16)
        .contentShape(Rectangle())
        .onTapGesture {
            if !hideCheckbox { onToggle() }
        }
    }
}
