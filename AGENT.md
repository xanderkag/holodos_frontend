# HOLODOS AI AGENT: Frontend Conventions & Standards 🧊🤖

Этот документ является **главным источником истины** ("Sacred Rules") для всей frontend-части приложения HOLODOS AI. Он фиксирует технологические стандарты, архитектуру, UI/UX паттерны и строгие правила интеграции. Документ отражает текущее состояние кода и должен обновляться синхронно с реальными изменениями в кодовой базе.

---

## 🏗️ Раздел 1. Технологический стек и Архитектура

- **Framework**: `React 19` (Functional Components, Hooks).
- **Build Tool**: `Vite 8`.
- **Language**: `TypeScript` (Strict mode).
- **Mobile Environment**: `Capacitor 8` (iOS, Android, PWA) + Telegram Mini App (TMA).
- **Styles**: Vanilla CSS с современными функциями (Nesting, CSS Variables, Backdrop filters).
- **Infrastructure**: `Firebase Auth` & `Firestore` (база данных), `Yandex Cloud S3` (медиа).

### Stateless Backend Pattern
Приложение построено по парадигме **"Stateless Backend"**. Frontend является исключительно потребителем API и отображает состояние, которым управляет backend.

1. **State Collection**: Frontend собирает текущее состояние пользователя (`list`, `stock`, `diary`, `baseline`) через `DataContext`.
2. **AI Request**: Все текстовые, голосовые и фото запросы идут через unified endpoints:
   - `POST /ai/text`
   - `POST /ai/voice`
   - `POST /ai/image`
3. **Action Application**: Backend возвращает единый `AiResponse` с `feedback`, `requiresConfirmation` и `actions[]`. `AiContext.tsx` парсит эти действия и применяет их к глобальному состоянию.
4. **Diary Binding**: Если в ответе присутствуют diary-actions (`target === 'diary'` или `to === 'diary'`), frontend сам связывает diary items с rich chat card через `chatMessageId`.

> [!CAUTION]
> **СТРОГОЕ ПРАВИЛО ИНТЕГРАЦИИ (НЕПРИКОСНОВЕННОСТЬ БЭКЕНДА):**
> Мы (Frontend) **НЕ ИМЕЕМ ПРАВА** вносить изменения в интеграцию с backend'ом. Схемы данных (`AiAction`, payload-запросы к `/ai/text`, `/ai/voice`, `/ai/image`), контракты и общая логика взаимодействия с API — неприкасаемы. Любые изменения формата обмена данными требуют строжайшего согласования с backend-отделом.

> [!IMPORTANT]
> **Актуальный Production Contract (15 апреля 2026):**
> - Основной продуктовый AI-flow идет через `text / voice / image`.
> - Маршруты `/diary/analyze-photo` и `/diary/analyze-voice` считаются legacy transition shim и **не используются**.
> - Source tagging (`photo` / `voice` / `text`) выполняется на стороне frontend **в `AiContext.tsx` и `SmartInput.tsx`**, строго перед вызовом `applyActions()`:
>   - `analyzeImage()` → `result.source = 'photo'`
>   - `sendChatCommand()` → `result.source = 'text'`
>   - Voice recording в `SmartInput` → `result.source = 'voice'`
> - **Multipart Uploads (Blob Strategy)**: Из-за специфики парсера Multer на Yandex Gateway, медиафайлы перед отправкой преобразуются из `base64` в бинарный `Blob` (`base64ToBlob`) и добавляются в `FormData` как файл (например, `"image.jpg"`, `"voice.webm"`). Передача сырых base64 строк напрямую запрещена.

---

## 🔐 Раздел 1.1. API Layer (`src/utils/api.ts`)

### `ApiError` — Класс ошибки API (актуально с v3.21.0)

Все HTTP-методы (`apiPost`, `apiPatch`, `apiPostFormData`) выбрасывают **`ApiError`** вместо стандартного `Error`.

```typescript
export class ApiError extends Error {
  public status: number;   // HTTP status code
  public code?: string;    // Серверный код ошибки (например: "limit_reached")
  public data?: any;       // Полный JSON-ответ от сервера
}
```

**Контракт по коду ошибки `limit_reached`:**
- HTTP status: `403`
- `error.code === 'limit_reached'`
- `error.data.subscription` содержит снимок подписки (план, статус, лимиты, использование)

### HTTP Headers (v3.21.1)

> [!CAUTION]
> **Использование заголовка `Authorization` запрещено при запросах к нашему бэкенду.** Платформа Yandex Serverless перехватывает его и обрубает запрос до попадания в наш код (генерируя 403).

Для всех авторизованных запросов к API (`apiPost`, `apiPatch`, `apiPostFormData`) используется кастомный заголовок:
- **Header**: `X-Firebase-Authorization`
- **Format**: `Bearer <firebase_id_token>`

### Правило обработки `limit_reached` в `AiContext.tsx`:
- **НЕ** считать 403 limit_reached падением AI — это валидный продуктовый ответ.
- **В chat flow** → добавить `system message` с `err.message` прямо в ленту чата.
- **В image flow** → показать `showToast(err.message)`.
- **В voice flow (SmartInput)** → вызвать `onLimitError(err.message)` → добавит системное сообщение через `handleLimitError`.
- **Во всех случаях** → если `err.data?.subscription` присутствует, вызвать `syncBackendSubscription(err.data.subscription)`.

---

## 📊 Раздел 1.2. Subscription Layer (Лимиты и Подписки)

> [!IMPORTANT]
> **Backend является источником правды по лимитам.** Frontend хранит локальные `stats` только как UI-подсказки (transitional UX layer), не как авторитетный источник.

### Гибридная модель лимитов:
| Компонент | Роль |
|-----------|------|
| Firebase `stats` | UI-подсказки, счётчики в Settings и DiaryScreen |
| Backend (403 / success) | **Окончательное решение** по лимитам |

### `syncBackendSubscription` в `DataContext.tsx`:
Метод, который принимает объект `subscription` от backend и немедленно перезаписывает локальное состояние:
- `stats.image.d` и `stats.voice.d` — дневные счётчики (из `usage`)
- `subscriptionType` — план (`free` / `pro`)
- `subscriptionStatus` — статус подписки
- `isSubscribed` — флаг

Вызывается в `AiContext.tsx`:
1. При ошибке `403 limit_reached` → если `err.data.subscription` присутствует.
2. При успешном ответе → если `result.subscription` присутствует (image, text, voice flows).

### Правило: нет двойного учёта (`incrementStat` — только fallback)
`incrementStat('image' | 'voice' | 'chat')` вызывается **только** если backend **не вернул** `subscription` в ответе:

```typescript
if (result.subscription) {
  syncBackendSubscription(result.subscription); // authoritative
} else {
  incrementStat('image'); // fallback only
}
```

Это исключает двойной учёт: когда бэк прислал точные usage-цифры, локальный +1 не нужен.

### Тарифные лимиты (текущие):
| Тариф | Фото в день | Голос в день |
|-------|------------|--------------|
| Free | 3 | 10 |
| Pro | 20 | 100 |

### Локальный `checkUsage`:
Можно использовать только как раннюю UI-подсказку (например, заблокировать кнопку до отправки). **Не является** финальным арбитром доступа — backend пересчитает сам.

---

## 🔐 Раздел 1.3. Client-Side Auth Logging (Аудит Авторизации)

Приложение реализует строгий контракт клиентского логирования для синхронизации с backend-аудитом (конкретно метод `POST /api/logs`).
Фронтенд отправляет логи авторизации через единую утилиту `authLogger.ts`.

> [!IMPORTANT]
> **ОПЕРАЦИИ С ТОКЕНАМИ В ЛОГАХ КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНЫ**.
> Функция `logAuthAudit()` автоматически очищает объект `meta`, удаляя `token`, `idToken`, `customToken` и заменяя их на булевые флаги типа `hasToken: true`. В БД должны попадать только факты наличия/отсутствия токена.

### Унифицированные параметры логирования
Фронтенд обязан оперировать строго определенными наборами (Enum-style):

1. **`provider`**: `google` | `yandex` | `telegram`
2. **`channel`**: `web` | `android` | `telegram_widget` | `telegram_miniapp`
3. **`stage`**:
   - `attempt` — нажатие кнопки или старт нативного flow.
   - `redirect_start` — уход на `signInWithRedirect` / `popup` / backend URL.
   - `redirect_result` — получение ответа от веб-редиректа (Google).
   - `callback_received` — прием токена из `appUrlOpen` или URL (Yandex).
   - `success` — успешное завершение Firebase Auth.
   - `failure` — любая ошибка в процессе (`error` level).

### Правила распределения (Firebase Auth & Plugins)
- **Native Android / Capacitor**:
  Инициирует `attempt`, получает токен плагином и сразу выдает `success` / `failure`. `getRedirectResult` для native platform **пропускается**.
- **Web App**:
  Инициирует `redirect_start`. При последующем монтировании `AuthContext` вызывает `getRedirectResult` и спамит логи с `redirect_result`, затем `success` / `failure`.

---

## 🎨 Раздел 2. Дизайн-система и UI Компоненты

Приложение использует премиальный стиль **Glassmorphism**.

### Глобальные стили (Design Tokens)
- Все отступы, радиусы и цвета задаются через `CSS-переменные` (e.g., `var(--bg-glass)`).
- **Темы (`data-theme`)**: Обязательная поддержка `light` и `dark`.
- **Плотность (`data-density`)**: Обязательная поддержка `comfortable` и `compact`.
- Ключевые классы контейнеров: `.glass-panel`, `.glass-pill`.

### Нативные отступы (iOS Safe Area Polyfill)
В Capacitor на iOS системные переменные `env(safe-area-inset-top)` иногда отдают `0px` из-за багов WebKit.
- Фронтенд использует CSS fallback через `max()`: `max(env(safe-area-inset-top, 0px), var(--sat-force))`.
- В `App.tsx` JS принудительно устанавливает `--sat-force: 47px` и `--sab-force: 34px` (только для iOS).
- Это гарантирует, что `Dynamic Island` или нижняя панель на iPhone не будут перекрывать контент приложения.

### Глобальные Компоненты
1. **`ActionSheet` & `Modal`**:
    - Плавное появление (класс `.animated-pop`). Модалки поверх всего контента.
    - `ActionSheet` выезжает снизу с учётом `safe-area-inset-bottom`.
2. **`PurchaseProgressBar`**:
    - Находится в `SubHeader` (например, на `ListScreen`).
    - Динамически вычисляет процент по `isChecked` элементам.
    - Содержит кнопку `handleFinishShopping`.
3. **`ItemRow` (Ряд списка)**:
    - **Свайпы**: порог срабатывания `threshold = 80px`.
    - **Чистота UI**: В левой части ряда категорически запрещены чекбоксы (`.item-bullet`). Только свайп.
    - **Динамический цвет**: Прозрачность фона плавно от 0 до 1 по мере свайпа. После 80px — 100% непрозрачный.
    - **Long Press**: 600ms → функция + микровибрация (`navigator.vibrate`).
    - **Клик**: < 10px смещения → открывает превью или переключает состояние.

---

## 🕹️ Раздел 3. Навигация и "Smart Bar" (SmartInput & TabBar)

`TabBar` и `SmartInput` составляют единый **Smart Bar** интерфейса.

> [!IMPORTANT]
> **SACRED RULES OF SMART BAR:**
> Логика свайпов и состояний Smart Bar является критической зоной пользовательского опыта. Упрощение анимаций, удаление жестов или изменение поведения без разрешения ЗАПРЕЩЕНЫ.

### `TabBar` (Жесты и анимации центральной кнопки)
- **Динамическая Центральная Кнопка**: Если не на вкладке Чат и `SmartInput` скрыт — показывает `➕ AI`. При активации — `💬 Чат`.
- **Свайп центральной капсулы**: Порог срабатывания `threshold = 80px`.
- **Визуальная заливка (Fill Effect)**:
    - Свайп ВПРАВО (`->`) → микрофон/запись. Заливка: **Зелёная** (`#34c759` / `rgba(52, 199, 89, 0.95)`).
    - Свайп ВЛЕВО (`<-`) → камера/галерея. Заливка: **Синяя** (`#007aff`).
- **Подсказки (Instant Hints)**: Иконки `📷` (слева) и `🎙️` (справа) появляются моментально при старте свайпа (`onTouchMove`).
- **Очистка пространства**: Остальные кнопки навигации скрываются (`quick-hidden`) при начале drag.

### `SmartInput` (Механика умного ввода)
Режимы (`state`):
1. `hidden` — по умолчанию скрыт.
2. `active` — клавиатура открыта. `window.visualViewport` синхронизирует позицию под клавиатуру на iOS/Android.
3. `media` — лоток прикрепления фото.
4. `recording` — запись голоса.

**Маршрутизация ввода:**
- Текст со слэшем (`/команда`) → AI backend (`sendChatCommand`).
- Обычный текст → локальное добавление в список (зависит от активной вкладки).

**Правило стилизации**: `text-align: left` обязателен. Центрирование ввода запрещено.

**Prop `onLimitError`**: `SmartInput` принимает колбек `onLimitError?: (message: string) => void`. При 403 limit_reached в голосовом flow вызывает его вместо generic toast. Прокидывается из `App.tsx` как `handleLimitError` из `useAi()`.

**Механика "Green Capsule"**: При переходе в `recording`, вся TabBar становится «Зелёной Капсулой». Сам `SmartInput` **строго скрывается**. Таймер и кнопка стоп рендерятся только внутри `TabBar.tsx` в компоненте `recording-mode-capsule`.

**Красный Крестик (Fail-Safe Stop Button)**: Во время записи (`recording` state) внутри зелёной капсулы **ВСЕГДА** должен быть красный стоп-кружок (`.recording-stop-btn-large`). Это accessibility fail-safe. Кнопка строго отцентрована (`position: absolute`), имеет белый фон и красную рамку для премиального контраста.

---

## 📱 Раздел 4. Экраны и Их Механика

### 1. `AuthScreen` & `Header` (Авторизация и Навигация)

#### Production Auth Matrix

| Метод | Платформа | Механика | Статус |
|-------|-----------|----------|--------|
| Google | Desktop Web | `signInWithPopup` | ✅ |
| Google | Mobile Browser | `signInWithRedirect` | ✅ |
| Google | Android / iOS (native) | `GoogleAuth.signIn()` → `signInWithCredential` | ✅ |
| Yandex | Web + Android | Backend OAuth → `?yandex_token=` → `signInWithCustomToken` | ✅ |
| Telegram Widget | Web | Widget flow → `/auth/telegram` → `signInWithCustomToken` | ✅ |
| Telegram Mini App | TMA | `initData` → `/auth/telegram` → `signInWithCustomToken` | ✅ |

> [!IMPORTANT]
> **СВЯЩЕННОЕ ПРАВИЛО AUTH (Native Platform):**
> На Android/iOS (Capacitor) `signInWithRedirect` и `getRedirectResult` **ЗАПРЕЩЕНЫ**.
> Там `capacitor://localhost` не является авторизованным доменом Firebase → `auth/unauthorized-domain`.
> Всегда использовать `isNativePlatform` из `src/utils/firebase.ts` для ветвления логики.

#### Native Google Sign-In (Android/iOS)
- Использует `@codetrix-studio/capacitor-google-auth@3.3.3`
- `GoogleAuth.signIn()` → возвращает `authentication.idToken`
- `GoogleAuthProvider.credential(idToken)` → `signInWithCredential(auth, credential)`
- `getRedirectResult` на native **пропускается** (`if (!isNativePlatform)`)
- `capacitor.config.ts`: `GoogleAuth.serverClientId` = Web Client ID (не Android Client ID)
- Отдельный Android OAuth Client ID нужен в Google Cloud Console:
  - Package: `com.holodos.ai`
  - SHA-1 debug: `93:12:3B:04:41:F5:57:D4:9E:74:40:44:33:3D:CC:5A:6D:7F:FF:AF`

#### Yandex Deep Link на Android
- `App.addListener('appUrlOpen', ...)` активен на native платформе
- Разбирает `?yandex_token=` из callback URL
- Поддерживает оба формата:
  - `holodos://auth?yandex_token=...` (custom scheme — backend-задача, ещё не реализована)
  - `https://app.holodos.su?yandex_token=...` (App Link, текущий)
- Listener живёт внутри `useEffect` и корректно очищается через `appUrlListener.remove()`

- **Header**: Плашки профиля (UserPill/аватарки) в шапке **запрещены**. Профиль — только в Настройках.
- **Высота шапки (iPhone UI Rules)**:
  - `position: fixed; top: 0; left: 0; right: 0;` (никаких `sticky`).
  - **Единственная правильная формула высоты**: `height: calc(var(--sat) + 56px);`
  - `padding-top: var(--sat);` обязателен, чтобы контент не уезжал под Dynamic Island.
  - `--hdr-h: 32px` — **УСТАРЕВШАЯ** переменная. Не использовать для отступов и высоты (`top`, `margin-top` и т.д.).
- **Контент экрана (`.screen`)**:
  - Базовый сдвиг от шапки: `padding-top: calc(var(--sat) + 58px);` (56px шапка + 2px зазор).
  - Для ChatScreen (где есть `SubHeader`): `padding-top: calc(var(--sat) + 100px);` (56px шапка + 44px SubHeader).
- **SubHeader (`.sub-header`)**:
  - `position: sticky; top: calc(var(--sat) + 56px); height: 44px; z-index: 100;`
- **TabBar (`.glass-tabbar`)**:
  - Вычисляется через `bottom: 0; height: calc(var(--tab-h) + var(--sab)); padding-bottom: var(--sab);` где `--tab-h` = 72px. Контент экрана имеет нижний паддинг `calc(var(--tab-h) + var(--sab) + 16px)`.
### 2. TMA Адаптации (Telegram Mini App)
В CSS классе `.telegram-miniapp` применяются специфические overrides:
- `--hdr-h: 10px` — уменьшенная высота шапки, т.к. TMA сам управляет верхним отступом.
- `.glass-tabbar { bottom: calc(16px + var(--sab, 0px) + 4px) }` — небольшой bump снизу для рукоятки TMA.
- `.smart-input-wrap { bottom: calc(var(--tab-h, 80px) + 50px) }` — приподнятый SmartInput.
- `SubHeader` blur: `top: -50px` вместо `-100px`, маска непрозрачна до 50% вместо 75%.

### 3. `ListScreen` (Список покупок)
- **Разделение**: Некупленное (`activeItems`) и Купленное (`checkedItems`).
- **Капсула "Куплено"**: Выполненные сворачиваются в стеклянный блок снизу.
- **DND**: `@dnd-kit`, порог пересечения 25% высоты контейнера.
- **`handleFinishShopping`**: Все `isChecked` удаляются из Списка и переносятся в `BaselineScreen`.

### 4. `BaselineScreen` (Наличие и Рецепты)
- **HOLODOS (Холодос/Сток)**:
    - Свайп Вправо → Фиолетовый → модалка «Съесть» (перенос в Дневник).
    - Свайп Влево → удаление.
- **Любимое (Шаблоны)**: Клик копирует в активный Список.
- **Рецепты**: Функция **"Добавить недостающее"** — сверяет ингредиенты с Холодосом и добавляет разницу в Список.

### 5. `DiaryScreen` (Дневник Питания)
- **Блок КБЖУ (`DiaryMacrosSummary`)**: 4 прогресс-бара по макронутриентам + интеграция Apple Health / Google Fit.
- **Распознавание Еды (Фото)**: Фото сжимается до **800px** (canvas), отправляется через `analyzeImage()` → `AiContext` → `/ai/image`. Загрузка анимируется пульс-индикатором.
- **Unified Diary Flow**: Фото, голос и текст для дневника идут через общий AI-pipeline (`/ai/image`, `/ai/voice`, `/ai/text`). Rich diary UX строится на фронте поверх обычного `AiResponse`.
- **Приёмы пищи (`DiaryMealGroup`)**: Завтрак, Обед, Ужин, Перекус.
- **Трекер воды**: Иконки-стаканы по 250мл, цель 2.5л, клик с хаптиком.

### 6. `ChatScreen` (Чат с AI)
- Центр всех взаимодействий.
- **Date Grouping**: Все 4 вкладки (Chat, Diary, All Events, Adding/Baseline) используют единую утилиту `groupItemsByDate` из `ChatScreen.tsx`. Даты отображаются как: «Сегодня», «Вчера», «Позавчера», «DD месяца», «Ранее».
- **System Message Timestamps**: Системные сообщения отображают поле `m.timestamp` (CSS класс `.msg-system-time`).
- **Mixed Intents**: Backend может вернуть одновременно diary-actions и list/stock-actions. Frontend применяет оба типа без потери `feedback`.
- **Diary Cards**: Если в ответе есть diary-actions, сообщение собирается как rich diary card с `diarySource: 'photo' | 'voice' | 'text'`.
- **Лимитные сообщения**: При `403 limit_reached` вместо generic ошибки добавляется `system message` с точным текстом от backend.
- **Подтверждение действий**: Блок с кнопками «Принять» / «Отменить» для пакетных и чувствительных операций.

---

## 🚫 Раздел 5. Запрещённые Действия (Forbidden Actions / The "Never-Ever" List)

1. **Неприкосновенность Бэкенда**: Структура API, пути эндпоинтов, контракты `AiAction` — нельзя менять без согласования с backend-командой.
2. **TabBar Swipes**: ЗАПРЕЩАЕТСЯ удалять или упрощать до кнопок свайпы на камере и микрофоне.
3. **Green Capsule Red Stop**: ЗАПРЕЩАЕТСЯ убирать красный крестик внутри зелёной капсулы при записи.
4. **TabBar Colors**: ЗАПРЕЩАЕТСЯ менять Зелёный для войсов (`#34c759`) и Синий для камеры (`#007aff`).
5. **Local Verification**: ЗАПРЕЩЕНО делать push в `main` без успешной сборки `npm run build`.
6. **Limit Source of Truth**: ЗАПРЕЩАЕТСЯ считать локальный `checkUsage` / `stats` финальным арбитром доступа к AI. Только backend.
7. **Generic AI Error on 403**: ЗАПРЕЩАЕТСЯ показывать "❌ Ошибка ИИ" при `limit_reached`. Это нормальный продуктовый ответ.
8. **Native Auth Redirect**: ЗАПРЕЩАЕТСЯ использовать `signInWithRedirect` или `getRedirectResult` на native (Capacitor) платформе. Проверять всегда через `isNativePlatform`.
9. **Commit Versioning (Agent Rule)**: ПРИ КАЖДОМ КОММИТЕ (и push) агент ОБЯЗАН указывать текущую версию программы (из `package.json`) в тексте коммита (например: `fix(ai) [v3.21.2]: revert to binary`). Это нужно для наглядности билдов в Vercel.

---

## 📋 Раздел 6. Ключевые Файлы (Map of Responsibility)

| Файл | Ответственность |
|------|----------------|
| `src/utils/api.ts` | HTTP методы + `ApiError` class |
| `src/utils/firebase.ts` | Firebase init, `loginWithGoogle` (native/web branching), `isNativePlatform` |
| `src/context/AuthContext.tsx` | Авторизация: Google (native/web), Yandex, Telegram, TMA. `appUrlOpen` listener. |
| `src/context/DataContext.tsx` | Глобальный стейт, Firebase sync, `syncBackendSubscription` |
| `src/context/AiContext.tsx` | AI orchestration, `analyzeImage`, `sendChatCommand`, `handleLimitError` |
| `src/utils/ai.ts` | Низкоуровневые AI-запросы: `analyzeImageWithContext`, `sendVoiceToN8N` |
| `src/utils/subscription.ts` | Локальный `checkUsage` (UI hint only) |
| `src/components/SmartInput.tsx` | Умный ввод, жесты, голосовая запись, `onLimitError` prop |
| `src/components/TabBar.tsx` | Навигация, Green Capsule, Red Stop Button |
| `src/screens/ChatScreen.tsx` | Лента чата, date grouping (`groupItemsByDate`), все 4 вкладки |
| `src/index.css` | Глобальные токены, TMA overrides |
| `scripts/patch-google-auth.js` | postinstall: патч `jcenter()→mavenCentral()` + proguard для Gradle 9+ |
| `android/app/src/main/AndroidManifest.xml` | Intent filters: production domains + `holodos://auth` scheme |
| `capacitor.config.ts` | Capacitor + GoogleAuth plugin config |

---

*Документ обновлён автоматически командой Antigravity. Версия: **v3.21.2** (15 апреля 2026).*
