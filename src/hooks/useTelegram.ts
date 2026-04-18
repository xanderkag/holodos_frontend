import { useMemo } from 'react';

// Extended type for Telegram WebApp fields not yet in @types/telegram-web-app
type TelegramWebAppExtended = typeof window.Telegram.WebApp & {
  isVerticalSwipesEnabled?: boolean;
  disableVerticalSwipes?: () => void;
  enableVerticalSwipes?: () => void;
  isExpanded?: boolean;
};

export const useTelegram = () => {
  const tg = window.Telegram?.WebApp as TelegramWebAppExtended | undefined;

  return useMemo(() => ({
    tg,
    user: tg?.initDataUnsafe?.user,
    queryId: tg?.initDataUnsafe?.query_id,
    onClose: () => tg?.close(),
    onToggleButton: () => {
      if (tg?.MainButton.isVisible) {
        tg?.MainButton.hide();
      } else {
        tg?.MainButton.show();
      }
    },
    expand: () => tg?.expand(),
    ready: () => tg?.ready(),
    disableVerticalSwipes: () => tg?.isVerticalSwipesEnabled && tg?.disableVerticalSwipes?.(),
    enableVerticalSwipes: () => !tg?.isVerticalSwipesEnabled && tg?.enableVerticalSwipes?.(),
    haptics: tg?.HapticFeedback,
    mainButton: tg?.MainButton,
    backButton: tg?.BackButton,
    themeParams: tg?.themeParams,
    isDark: tg?.colorScheme === 'dark',
    isExpanded: tg?.isExpanded,
    platform: tg?.platform,
    initData: tg?.initData
  }), [tg]);
};
