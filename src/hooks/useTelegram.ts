import { useMemo } from 'react';

export const useTelegram = () => {
  const tg = window.Telegram?.WebApp;

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
    // @ts-ignore
    disableVerticalSwipes: () => tg?.isVerticalSwipesEnabled && tg?.disableVerticalSwipes(),
    haptics: tg?.HapticFeedback,
    mainButton: tg?.MainButton,
    backButton: tg?.BackButton,
    themeParams: tg?.themeParams,
    isDark: tg?.colorScheme === 'dark',
    // @ts-ignore
    isExpanded: tg?.isExpanded,
    platform: tg?.platform
  }), [tg]);
};
