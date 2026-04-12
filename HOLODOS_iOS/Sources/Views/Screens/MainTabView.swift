import SwiftUI

struct MainTabView: View {
    @State private var viewModel = StoreViewModel()
    @State private var selectedTab = 0
    
    var body: some View {
        ZStack(alignment: .bottom) {
            // Background Gradient
            LinearGradient(colors: [Color.blue.opacity(0.1), Color.white, Color.orange.opacity(0.1)],
                           startPoint: .topLeading,
                           endPoint: .bottomTrailing)
                .ignoresSafeArea()
            
            TabView(selection: $selectedTab) {
                ShoppingListView(viewModel: viewModel)
                    .tabItem {
                        Label("Покупки", systemImage: "cart")
                    }
                    .tag(0)
                
                FridgeView(viewModel: viewModel)
                    .tabItem {
                        Label("Наличие", systemImage: "fridge")
                    }
                    .tag(1)
                
                RecipeBrowserView(viewModel: viewModel)
                    .tabItem {
                        Label("Рецепты", systemImage: "fork.knife")
                    }
                    .tag(2)
                
                SettingsView(viewModel: viewModel)
                    .tabItem {
                        Label("Профиль", systemImage: "person")
                    }
                    .tag(3)
            }
            .accentColor(.blue)
            .onAppear {
                // Adjust tab bar appearance if needed
            }
        }
    }
}

// Simple Settings Placeholder for now
struct SettingsView: View {
    var viewModel: StoreViewModel
    
    var body: some View {
        NavigationStack {
            List {
                Section("Аккаунт") {
                    Text(FirebaseManager.shared.currentUser?.email ?? "Гость")
                    Button("Выйти", role: .destructive) {
                        FirebaseManager.shared.signOut()
                    }
                }
            }
            .navigationTitle("Профиль")
        }
    }
}
