import SwiftUI
import FirebaseAuth

struct AuthView: View {
    @State private var email = ""
    @State private var password = ""
    @State private var isLogin = true
    @State private var isLoading = false
    @State private var errorMessage: String? = nil
    
    var body: some View {
        ZStack {
            Color.blue.opacity(0.05).ignoresSafeArea()
            
            VStack(spacing: 24) {
                VStack(spacing: 12) {
                    Text("🧊")
                        .font(.system(size: 80))
                    Text("HOLODOS AI")
                        .font(.system(size: 32, weight: .black))
                        .foregroundStyle(.primary)
                    Text("Ваш идеальный холодильник")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.bottom, 20)
                
                GlassCard {
                    VStack(spacing: 16) {
                        Text(isLogin ? "С возвращением!" : "Создать аккаунт")
                            .font(.headline)
                        
                        TextField("Email", text: $email)
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                            .padding()
                            .background(Color.white.opacity(0.5))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        
                        SecureField("Пароль", text: $password)
                            .padding()
                            .background(Color.white.opacity(0.5))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        
                        if let error = errorMessage {
                            Text(error)
                                .font(.caption)
                                .foregroundStyle(.red)
                        }
                        
                        Button(action: handleAuth) {
                            HStack {
                                if isLoading { ProgressView() }
                                Text(isLogin ? "Войти" : "Зарегистрироваться")
                                    .bold()
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(.blue)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .shadow(color: .blue.opacity(0.3), radius: 8, x: 0, y: 4)
                        }
                        .disabled(isLoading || email.isEmpty || password.count < 6)
                        
                        Button {
                            isLogin.toggle()
                        } label: {
                            Text(isLogin ? "Нет аккаунта? Создать" : "Уже есть аккаунт? Войти")
                                .font(.caption)
                                .foregroundStyle(.blue)
                        }
                    }
                    .padding(8)
                }
                .padding(.horizontal)
                
                Spacer()
            }
            .padding(.top, 60)
        }
    }
    
    private func handleAuth() {
        isLoading = true
        errorMessage = nil
        
        if isLogin {
            Auth.auth().signIn(withEmail: email, password: password) { result, error in
                self.isLoading = false
                if let error = error {
                    self.errorMessage = error.localizedDescription
                } else {
                    FirebaseManager.shared.currentUser = result?.user
                    if let uid = result?.user.uid {
                        FirebaseManager.shared.startListening(uid: uid)
                    }
                }
            }
        } else {
            Auth.auth().createUser(withEmail: email, password: password) { result, error in
                self.isLoading = false
                if let error = error {
                    self.errorMessage = error.localizedDescription
                } else {
                    FirebaseManager.shared.currentUser = result?.user
                    if let uid = result?.user.uid {
                        FirebaseManager.shared.startListening(uid: uid)
                    }
                }
            }
        }
    }
}
