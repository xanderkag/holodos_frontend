import Foundation
import FirebaseFirestore
import FirebaseAuth

@MainActor
@Observable
class FirebaseManager {
    static let shared = FirebaseManager()
    
    var currentUser: User?
    var appData: AppData?
    var isLoading = true
    var errorMessage: String?
    
    private var db: Firestore { Firestore.firestore() }
    private var listener: ListenerRegistration?
    
    private init() {
        // Empty init to avoid premature Firebase SDK calls
    }
    
    func checkAuthStatus() {
        self.currentUser = Auth.auth().currentUser
        if let uid = self.currentUser?.uid {
            startListening(uid: uid)
        } else {
            self.isLoading = false
        }
    }
    
    func startListening(uid: String) {
        listener?.remove()
        
        let userRef = db.collection("users").document(uid)
        
        listener = userRef.addSnapshotListener { [weak self] snapshot, error in
            guard let self = self else { return }
            self.isLoading = false
            
            if let error = error {
                self.errorMessage = error.localizedDescription
                return
            }
            
            guard let snapshot = snapshot, snapshot.exists else {
                // Initialize default data if profile doesn't exist
                self.initializeDefaultData(uid: uid)
                return
            }
            
            do {
                self.appData = try snapshot.data(as: AppData.self)
            } catch {
                print("Decoding error: \(error)")
                self.errorMessage = "Ошибка загрузки данных"
            }
        }
    }
    
    private func initializeDefaultData(uid: String) {
        let defaultData: [String: Any] = [
            "list": [],
            "base": [],
            "stock": [],
            "recipes": [],
            "stores": [["name": "Перекрёсток"], ["name": "Магнит"], ["name": "ВкусВилл"]]
        ]
        
        db.collection("users").document(uid).setData(defaultData)
    }
    
    func updateField<T: Encodable>(_ field: String, value: T) {
        guard let uid = currentUser?.uid else { return }
        
        do {
            let encodedValue = try Firestore.Encoder().encode(value)
            db.collection("users").document(uid).updateData([
                field: encodedValue
            ])
        } catch {
            print("Encoding error: \(error)")
        }
    }
    
    func signOut() {
        try? Auth.auth().signOut()
        self.currentUser = nil
        self.appData = nil
        self.listener?.remove()
    }
}
