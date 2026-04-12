import SwiftUI

struct FridgeView: View {
    @Bindable var viewModel: StoreViewModel
    @State private var mode: FridgeMode = .stock
    @State private var inputText: String = ""
    
    enum FridgeMode: String, CaseIterable, Identifiable {
        case stock = "В наличии"
        case base = "База"
        var id: Self { self }
    }
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Segmented Control
                Picker("Режим", selection: $mode) {
                    ForEach(FridgeMode.allCases) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .padding()
                
                let activeData = mode == .stock ? viewModel.stock : viewModel.base
                
                if activeData.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: mode == .stock ? "snowflake" : "house")
                            .font(.system(size: 64))
                            .foregroundStyle(.gray.opacity(0.3))
                        Text(mode == .stock ? "Холодильник пока пуст" : "База продуктов пуста")
                            .font(.headline)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(activeData) { item in
                            ItemRowView(item: item, onToggle: {}, onDelete: {
                                if mode == .stock { viewModel.deleteFromStock(id: item.id) }
                                else { viewModel.deleteFromBase(id: item.id) }
                            }, onEdit: {
                                // Edit placeholder
                            }, hideCheckbox: true)
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                            .swipeActions {
                                Button(role: .destructive) {
                                    if mode == .stock { viewModel.deleteFromStock(id: item.id) }
                                    else { viewModel.deleteFromBase(id: item.id) }
                                } label: {
                                    Label("Удалить", systemImage: "trash")
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
                
                // Smart Input Area
                HStack(spacing: 12) {
                    TextField(mode == .stock ? "В наличие..." : "В базу...", text: $inputText)
                        .padding(12)
                        .background(.ultraThinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .onSubmit { submitInput() }
                    
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
            .navigationTitle(mode == .stock ? "Наличие" : "База")
            .toolbar {
                if mode == .base {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("В список") {
                            viewModel.moveBaseToShoppingList()
                        }
                        .font(.subheadline.bold())
                    }
                }
            }
        }
    }
    
    private func submitInput() {
        guard !inputText.isEmpty else { return }
        if mode == .stock {
            viewModel.addItemToStock(inputText)
        } else {
            viewModel.addItemToBase(inputText)
        }
        inputText = ""
    }
}
