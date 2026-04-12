import SwiftUI

struct ShoppingListView: View {
    @Bindable var viewModel: StoreViewModel
    @State private var inputText: String = ""
    @State private var editingItem: Item? = nil
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if viewModel.shoppingList.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "cart.badge.plus")
                            .font(.system(size: 64))
                            .foregroundStyle(.gray.opacity(0.3))
                        Text("Список покупок пуст")
                            .font(.headline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(viewModel.shoppingList) { item in
                            ItemRowView(item: item, onToggle: {
                                viewModel.toggleCheck(id: item.id)
                            }, onDelete: {
                                viewModel.deleteFromList(id: item.id)
                            }, onEdit: {
                                editingItem = item
                            })
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    viewModel.deleteFromList(id: item.id)
                                } label: {
                                    Label("Удалить", systemImage: "trash")
                                }
                                
                                Button {
                                    editingItem = item
                                } label: {
                                    Label("Править", systemImage: "pencil")
                                }
                                .tint(.blue)
                            }
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
                
                // Smart Input Area
                HStack(spacing: 12) {
                    TextField("Добавить продукты...", text: $inputText)
                        .padding(12)
                        .background(.ultraThinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .onSubmit {
                            submitInput()
                        }
                    
                    Button(action: submitInput) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 32))
                            .foregroundStyle(.blue)
                    }
                    .disabled(inputText.isEmpty)
                }
                .padding()
                .background(.ultraThinMaterial)
            }
            .navigationTitle("Покупки")
            .sheet(item: $editingItem) { item in
                EditItemView(item: item, onSave: { name, qty in
                    viewModel.updateItemInList(id: item.id, name: name, qty: qty)
                })
                .presentationDetents([.medium])
            }
        }
    }
    
    private func submitInput() {
        guard !inputText.isEmpty else { return }
        viewModel.addItemToList(inputText)
        inputText = ""
    }
}

// Simple Edit View Placeholder
struct EditItemView: View {
    let item: Item
    var onSave: (String, String?) -> Void
    
    @State private var name: String
    @State private var qty: String
    @Environment(\.dismiss) var dismiss
    
    init(item: Item, onSave: @escaping (String, String?) -> Void) {
        self.item = item
        self.onSave = onSave
        _name = State(initialValue: item.name)
        _qty = State(initialValue: item.qty ?? "")
    }
    
    var body: some View {
        NavigationStack {
            Form {
                TextField("Название", text: $name)
                TextField("Количество (напр. 2 шт)", text: $qty)
            }
            .navigationTitle("Редактировать")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Отмена") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Сохранить") {
                        onSave(name, qty.isEmpty ? nil : qty)
                        dismiss()
                    }
                }
            }
        }
    }
}
