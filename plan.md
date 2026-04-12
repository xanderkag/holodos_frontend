# Описание задачи
Миграция проверок лимитов подписок на Backend:
1. Ошибки лимитов (403 limit_reached) не должны крашить AI flow.
2. priority и локально проверяемые лимиты теперь вторичны относительно бэкенда.
3. Ошибки лимитов возвращаются с нужным форматом (объект `subscription`, `usageType`, `message`).

## User Review Required

> [!IMPORTANT]
> 1. Если бэкенд отбивает запрос из-за лимита (`limit_reached`), как лучше показать ошибку? 
>    - Добавить системное сообщение в чат с текстом из `message` (через addSystemMessage)?
>    - Просто показать всплывающий `showToast`? В плане я предложу гибрид: `addSystemMessage` для чата/голоса и `showToast` для фото (поскольку фото может добавляться из других мест).
> 2. Сейчас локальные `stats` берутся в режиме реального времени из Firebase. Я добавлю `ApiError` с сервером `subscription` данными, но чтобы обновить локально `stats`, нужно будет изменять context, либо просто полагаться на сам reject и показывать пользователю текст из `message`. Оставим текущий Firebase sync, но приоритетно будем показывать причину из ошибки API?

## Proposed Changes

### [API Error Structure]
#### [MODIFY] `src/utils/api.ts`
- Создать класс `ApiError` расширяющий Error, который будет хранить `status`, `code` и `data`.
- В `apiPost`, `apiPatch`, `apiPostFormData` ловить не-OK ответы, парсить JSON и пробрасывать `ApiError(err.message, response.status, err.code, err)`.

### [AI Integration & Error Handling]
#### [MODIFY] `src/context/AiContext.tsx`
- Вызовы `checkUsage` можно оставить для раннего отлова, но `priority` больше не является главным блокиратором для бэкенда.
- В `sendChatCommand` обернуть обработку ошибок `try/catch`. Если `error instanceof ApiError && error.status === 403 && error.code === 'limit_reached'`, парсить сообщение и выводить через `appendMessage(..., role: 'system')` с текстом `err.message`. И НЕ считать это `setIsAiLoading(false)` падением.
- В `analyzeImage` сделать то же самое (выводить `showToast` или `appendMessage`).
- Опционально: если приходит актуальный блок `subscription` из ошибки, можно отображать попап подписки (Paywall) или обновлять локальные лимиты (пока оставим вызов Paywall).

#### [MODIFY] `src/utils/ai.ts`
- Разрешить прокидывать `ApiError` наверх без жесткого логирования как "backend-image-FAILED", если это 403 лимит.

