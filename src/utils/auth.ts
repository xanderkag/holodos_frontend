/**
 * Centralized utility to map technical auth errors into user-friendly Russian messages.
 */
export const mapAuthErrorToMessage = (error: any): string => {
  if (!error) return 'Произошла неизвестная ошибка';

  const code = error.code || '';
  const message = error.message || '';

  // Firebase Auth Errors
  if (code === 'auth/popup-blocked') return 'Вход заблокирован всплывающим окном. Разрешите всплывающие окна для работы.';
  if (code === 'auth/popup-closed-by-user') return 'Окно входа было закрыто до завершения авторизации.';
  if (code === 'auth/cancelled-via-redirect') return 'Авторизация через редирект была прервана.';
  if (code === 'auth/network-request-failed') return 'Проблема с сетью. Проверьте интернет-соединение.';
  if (code === 'auth/invalid-email') return 'Некорректный формат почты.';
  if (code === 'auth/user-disabled') return 'Ваш аккаунт заблокирован.';
  if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'Неверная почта или пароль.';
  }
  if (code === 'auth/unauthorized-domain') return 'Этот домен не разрешен для авторизации Google.';

  // Custom Backend Errors
  if (message.includes('400') || code === '400') return 'Некорректный запрос (400). Попробуйте позже.';
  if (message.includes('403') || code === '403') return 'Доступ запрещен (403). Проверьте права доступа.';
  if (message.includes('404') || code === '404') return 'Сервер авторизации временно недоступен (404).';
  if (message.includes('500') || code === '500') return 'Внутренняя ошибка сервера (500). Мы уже чиним.';
  
  // Yandex Specifics
  if (message.includes('yandex_error') || error.yandex_error) {
    const reason = error.reason || error.yandex_error || message;
    if (reason.includes('access_denied')) return 'Вы отклонили запрос на доступ через Яндекс.';
    if (reason.includes('server_error')) return 'Ошибка на стороне сервера Яндекс. Попробуйте позже.';
    if (reason.includes('no_code')) return 'Яндекс не предоставил код авторизации.';
    return `Ошибка Яндекса: ${reason}`;
  }

  return message || 'Произошла ошибка при входе. Попробуйте другой способ.';
};
