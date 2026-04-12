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
    img.src = base64Str;
    img.onload = () => {
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

        // 0.6 quality strongly minimizes payload for n8n AI Vision
        const finalBase64 = canvas.toDataURL('image/jpeg', 0.6);
        
        // n8n generally rejects payloads over 1MB without nginx tweaks.
        if (finalBase64.length > 1300000) { // ~1.3MB string length
          reject(new Error(`После сжатия файл всё еще слишком велик (${Math.round(finalBase64.length / 1024)} KB)`));
        } else {
          resolve(finalBase64);
        }
      } catch (err: any) {
        reject(new Error(`Ошибка Canvas: ${err.message}`));
      }
    };
    img.onerror = () => {
      reject(new Error(`Ошибка декодирования: изображение повреждено или огромного размера.`));
    };
  });
};
