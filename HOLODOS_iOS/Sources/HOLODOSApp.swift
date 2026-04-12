import SwiftUI
import FirebaseCore

@MainActor
class AppDelegate: NSObject, UIApplicationDelegate {
  func application(_ application: UIApplication,
                   didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
    FirebaseApp.configure()
    return true
  }
}

@main
struct HOLODOSApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate
    
    // In Swift 6 / MainActor context, we can initialize this directly or in an init
    @State private var firebaseManager = FirebaseManager.shared
    
    var body: some Scene {
        WindowGroup {
            MainContentView()
                .environment(firebaseManager)
        }
    }
}

struct MainContentView: View {
    @Environment(FirebaseManager.self) var firebaseManager
    
    var body: some View {
        Group {
            if firebaseManager.isLoading {
                VStack {
                    @MainActor in
                    Text("🧊").font(.system(size: 60))
                    ProgressView()
                        .padding()
                }
            } else if firebaseManager.currentUser != nil {
                MainTabView()
                    .transition(.opacity)
            } else {
                AuthView()
                    .transition(.move(edge: .bottom))
            }
        }
        .onAppear {
            firebaseManager.checkAuthStatus()
        }
    }
}
