# HOLODOS AI — Frontend

> React 19 · Vite 8 · TypeScript · Capacitor 8 · Firebase · Yandex Cloud S3

Мобильное PWA-приложение для умного управления холодильником, списком покупок и дневником питания. Работает в браузере, Telegram Mini App и как нативный Android-приложение (RuStore / APK).

---

## 🚀 Быстрый старт

```bash
npm install        # установка зависимостей (+ автопатч capacitor-google-auth)
npm run dev        # dev-сервер на http://localhost:5173
npm run build      # production build
npm run verify     # build + preview
```

### Автоматический деплой (Yandex S3)
Реализован через **GitHub Actions** (`.github/workflows/deploy-yandex.yml`). 
При каждом пуше в ветку `main` проект автоматически собирается и деплоится в бакет `holodos-app-ru` (доступен по `app-ru.holodos.su`). Ручной деплой через скрипты больше не требуется.

---

## 📱 Платформы

| Платформа | Статус | Домен / ID |
|-----------|--------|-----------|
| Web (RU) | ✅ Prod | `https://app-ru.holodos.su` |
| Web (INT) | ✅ Prod | `https://app.holodos.su` |
| Telegram Mini App | ✅ Prod | `@HolodosAI_bot` |
| Android APK | ✅ Prod | `com.holodos.ai` |
| iOS | 🔜 | — |

---

## 🏗️ Технологический стек

| Слой | Технология |
|------|-----------|
| UI Framework | React 19 (Functional + Hooks) |
| Build | Vite 8 |
| Types | TypeScript 5 (strict) |
| Mobile | Capacitor 8 |
| Styles | Vanilla CSS (CSS Variables, Nesting, Backdrop-filter) |
| Auth | Firebase Auth (Google, Yandex via backend, Telegram) |
| DB | Firestore |
| Media | Yandex Cloud Object Storage (S3-compatible) |
| AI | Backend n8n → `/ai/text`, `/ai/voice`, `/ai/image` |
| Native Http | `CapacitorHttp` для обхода браузерных CORS preflight на Yandex Gateway |

---

## 🔐 Авторизация

### Архитектура (актуальная)

```
Web (desktop)       → signInWithPopup (Google)
Web (mobile browser)→ signInWithRedirect (Google)
Android / iOS       → GoogleAuth.signIn() → signInWithCredential  ← native, нет redirect
Yandex (все)        → backend OAuth → ?yandex_token= → signInWithCustomToken
Telegram (browser)  → Widget flow → /auth/telegram → signInWithCustomToken
Telegram (TMA)      → initData → /auth/telegram → signInWithCustomToken
```

### Client-Side Auth Logging (Аудит)
Внедрен единый контракт отправки auth-логов на `POST /api/logs` (через `authLogger.ts`).
- **Стэйт-машина (`stage`)**: `attempt` → `redirect_start` → `redirect_result` / `callback_received` → `success` | `failure`
- Обязательная привязка к `provider` (`google` | `yandex` | `telegram`) и `channel` (`web` | `android` | `telegram_widget` | `telegram_miniapp`).
- Любые операции записи токенов в лог строго запрещены (только флаг `hasToken: true`).

### HTTP Headers & Backend Proxy
> [!CAUTION]
> Для всех запросов к бэкенду (`/ai/*`, `/diary/*`) **обязательно** использование заголовка `X-Firebase-Authorization` вместо стандартного `Authorization`. Это необходимо для обхода фильтрации на уровне Yandex Cloud Serverless.

### Google Sign-In на Android
- Использует `@codetrix-studio/capacitor-google-auth@3.3.3`
- `isNativePlatform` (из `@capacitor/core`) — определяет платформу
- На Android/iOS: нативный Google Sign-In SDK → `idToken` → `signInWithCredential`
- **Не использует** `signInWithRedirect` на native — нет проблемы `auth/unauthorized-domain`
- `getRedirectResult` на native — **пропускается**

### Yandex на Android (глубокие ссылки)
- `App.addListener('appUrlOpen', ...)` — готов и слушает callbacks
- Разбирает `?yandex_token=` из URL (work: `holodos://auth?...` и `https://app.holodos.su?...`)
- **Ожидает** backend-задачу: изменить Yandex OAuth `redirect_uri` на deep link

### Что нужно для Google Sign-In на Android (вручную)
1. Перейти в [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials
2. Создать OAuth 2.0 Client ID → тип **Android**
3. Package name: `com.holodos.ai`
4. SHA-1 debug: `93:12:3B:04:41:F5:57:D4:9E:74:40:44:33:3D:CC:5A:6D:7F:FF:AF`
5. SHA-1 release: получить из release keystore (пока не настроен)

---

## 💳 Subscription & Limits

### Архитектура лимитов (v3.21.0+)

Backend является **источником правды** по дневным лимитам использования AI.

| Тариф | Фото/день | Голос/день |
|-------|-----------|-----------|
| Free | 10 | 30 |
| Pro | 20 | 100 |

### Правила обработки ответов

```typescript
// При успешном ответе:
if (result.subscription) {
  syncBackendSubscription(result.subscription); // ← авторитет
} else {
  incrementStat('image'); // ← fallback, только если backend не прислал snapshot
}

// При 403 limit_reached:
// - chat flow → system message в ленте чата
// - image/voice → showToast(err.message)
// - всегда: syncBackendSubscription(err.data.subscription)
```

### Формат ошибки от backend
```json
{
  "error": "Subscription Required",
  "code": "limit_reached",
  "message": "Вы исчерпали лимит фото (3/3). Перейдите на Pro.",
  "usageType": "image",
  "subscription": {
    "plan": "free",
    "status": "free",
    "isSubscribed": false,
    "limits": { "image": 3, "voice": 10 },
    "usage": { "image": 3, "voice": 5 }
  }
}
```

---

## 🤖 AI Flow

### Unified 3-Modality Architecture

Все запросы к AI идут через 3 эндпоинта:

| Эндпоинт | Тип | Source Tag |
|----------|-----|-----------|
| `POST /ai/text` | text / voice | `text` / `voice` |
| `POST /ai/image` | фото | `photo` |
| `POST /ai/voice` | аудио файл | `voice` |

- Source tagging устанавливается на фронте в `AiContext.tsx` и `SmartInput.tsx`
- Backend возвращает `AiResponse` с `actions[]`, `feedback`, `requiresConfirmation` и опциональным `intent`.
- **Voice Intents**:
  - Бэкенд классифицирует голосовые запросы (stock_analysis, food_diary, product_action).
  - Информацию о пищевом приёме (завтрак, обед, и т.д.) бэкенд возвращает в `meal_type` каждого `action.item`.
  - При `intent: 'stock_analysis'` бэкенд возвращает пустой массив `actions` и детали в `tagged_items`. Фронт рендерит интерактивные карточки со статусами на основе этих тегов.
- `applyActions()` в `AiContext.tsx` применяет все actions к глобальному стейту. Примечания:
  - Сущности для Дневника (`target: 'diary'`) добавляются **прямым пушем**, чтобы сохранить уникальные ключи `chatMessageId`.
  - Поля пищевой ценности (`kcal`, `protein`, `fat`, `carbs`) переносятся один к одному из AI payload в State.
  - Если приходит action `type: "check"`, `target: "list"`, а товара нет в списке — фронтенд **сам** добавит его и отметит выполненным.

### Производительность (Performance v3.22.20+)
- **Code-Splitting**: Основные экраны загружаются лениво через `React.lazy` и `<Suspense>` (`AdminScreen`, `ListScreen`, `BaselineScreen`, `DiaryScreen`, `SettingsScreen`, `EventsScreen`).
- **Memoization**: Интенсивно рендерящиеся компоненты (`ItemRow`, `DiaryMealGroup`) обернуты в `React.memo` с кастомными функциями сравнения (equals). Это блокирует каскадный ререндер списка при изменениях, не касающихся конкретного элемента.

### Гибридная загрузка медиа
Из-за проблем Yandex API Gateway с прерыванием соединений `multipart/form-data` на стороне WebView/Capacitor, передача медиа (аудио/фото) с мобильных клиентов происходит в виде чистого JSON-объекта (base64 string). PWA и Web продолжают использовать стандартную `FormData`.

### ApiError
```typescript
class ApiError extends Error {
  status: number;  // HTTP код
  code?: string;   // "limit_reached" и др.
  data?: any;      // полный JSON ответа
}
```

---

## 🤖 Android сборка

```bash
# 1. Build web assets
npm run build

# 2. Sync to Android
npx cap sync android

# 3. Build APK (debug)
cd android && ./gradlew assembleDebug

# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

### Версионирование
- Версия автоматически синхронизируется `scripts/update-version.js`
- Web: `package.json` → `version`
- Android: `android/app/build.gradle` → `versionName` + `versionCode`
- iOS: `ios/App/App.xcodeproj/project.pbxproj`

### Gradle patches (postinstall)
`scripts/patch-google-auth.js` автоматически исполняется после `npm install`:
- `jcenter()` → `mavenCentral()` (Gradle 9+ совместимость)
- `proguard-android.txt` → `proguard-android-optimize.txt` (R8 оптимизация)

---

## 📋 AndroidManifest Deep Links

```xml
<!-- Prod App Links (Yandex OAuth return, App Links) -->
<data android:scheme="https" android:host="app.holodos.su" />
<data android:scheme="https" android:host="app-ru.holodos.su" />

<!-- Custom scheme (Yandex deep link, backend pending) -->
<data android:scheme="holodos" android:host="auth" />

<!-- Legacy Firebase (оставлены до smoke-test) -->
<data android:scheme="https" android:host="holodos-6ff24.firebaseapp.com" />
```

---

## 🗂️ Структура проекта

```
src/
├── context/
│   ├── AuthContext.tsx     # Авторизация (Google, Yandex, Telegram, TMA)
│   ├── AiContext.tsx       # AI orchestration, limit handling
│   └── DataContext.tsx     # Глобальный стейт, Firebase sync, syncBackendSubscription
├── utils/
│   ├── api.ts              # HTTP методы (apiPost, apiPatch, apiPostFormData) + ApiError
│   ├── firebase.ts         # Firebase init, loginWithGoogle (native/web branching)
│   ├── ai.ts               # Низкоуровневые AI-запросы
│   └── subscription.ts     # checkUsage (UI hint only, не авторитет)
├── components/
│   ├── SmartInput.tsx      # Умный ввод (text/voice/media)
│   └── TabBar.tsx          # Навигация, Green Capsule, Red Stop
├── screens/
│   ├── ChatScreen.tsx      # Лента чата, date grouping
│   ├── ListScreen.tsx      # Список покупок
│   ├── BaselineScreen.tsx  # Холодос + рецепты
│   └── DiaryScreen.tsx     # Дневник питания
scripts/
├── update-version.js       # Автосинхронизация версии
└── patch-google-auth.js    # Gradle-совместимость (jcenter → mavenCentral)
android/
└── app/src/main/
    ├── AndroidManifest.xml
    └── assets/public/      # Скомпилированный web bundle
```

---

## 🔧 Переменные окружения

| Переменная | Описание |
|-----------|----------|
| `VITE_BACKEND_URL` | URL backend (Yandex Cloud) |
| `VITE_FIREBASE_API_KEY` | Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firestore bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | FCM sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase App ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | GA Measurement ID |

---

## 🌐 Домены (Firebase Authorized Domains)

Должны быть добавлены в Firebase Console → Authentication → Settings → Authorized domains:
- `app.holodos.su`
- `app-ru.holodos.su`
- `holodos-6ff24.firebaseapp.com` (legacy)

Google Cloud Console → OAuth 2.0 → Authorized JavaScript origins:
- `https://app.holodos.su`
- `https://app-ru.holodos.su`

---

## 🎨 Интерфейс и Верстка
Подробные правила работы с UI (стекла, слои, паддинги, позиционирование шапки/сабхедера) и цветовые палитры вынесены в отдельный документ: 
👉 [**README-interface.md**](./README-interface.md)

---

## 📌 Текущая версия

**v3.22.20** | 17 апреля 2026
