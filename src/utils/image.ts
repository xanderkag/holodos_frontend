/**
 * Fast client-side image compression using Canvas.
 * Optimizes photos for n8n webhooks and prevents browser 'Load fail' events.
 */
export const compressImage = (base64Str: any, maxWidth = 800): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!base64Str || typeof base64Str !== 'string' || base64Str.length < 100) {
      return reject(new Error(`Некорректные данные изображения (длина: ${base64Str?.length || 0})`));
    }
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Prevent CORS taint on some Android Chrome versions

    // Timeout: if image doesn't load in 5s, it's probably corrupt
    const timeout = setTimeout(() => {
      reject(new Error('Изображение не загрузилось за 5 секунд'));
    }, 5000);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        let canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions maintain aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
        }

        let finalBase64 = canvas.toDataURL('image/jpeg', 0.6);
        
        // If still too large for Android/n8n, re-compress at lower quality
        if (finalBase64.length > 1300000) {
          finalBase64 = canvas.toDataURL('image/jpeg', 0.4);
        }
        // Hard cap — something is very wrong if still over 2MB
        if (finalBase64.length > 2000000) {
          reject(new Error(`Файл слишком большой даже после сжатия. Попробуйте другую фото.`));
        } else {
          resolve(finalBase64);
        }
      } catch (err: any) {
        reject(new Error(`Ошибка Canvas: ${err.message}`));
      }
    };
    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error(`Ошибка декодирования: изображение повреждено или огромного размера.`));
    };
    img.src = base64Str;
  });
};
