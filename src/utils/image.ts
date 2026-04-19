/**
 * Fast client-side image compression using Canvas.
 * Optimizes photos for n8n webhooks and prevents browser 'Load fail' events.
 *
 * v2: Uses URL.createObjectURL() instead of FileReader to prevent
 * iOS Safari OOM crashes with large camera photos (4-10MB).
 */

const MAX_SIDE_PX = 900; // Keep quality reasonable for food AI analysis

/** Compress a File/Blob directly — memory-safe for iOS Safari */
export const compressFile = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Guard: immediately reject if clearly not an image
    if (file.size === 0) {
      return reject(new Error('Пустой файл'));
    }

    // Use createObjectURL — avoids loading entire file into JS heap
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    const timeout = setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Изображение не загрузилось за 8 секунд'));
    }, 8000);

    img.onload = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(objectUrl); // Free memory immediately after decode

      try {
        let { width, height } = img;

        // Scale down so longest side ≤ MAX_SIDE_PX
        if (width > height) {
          if (width > MAX_SIDE_PX) {
            height = Math.round((height * MAX_SIDE_PX) / width);
            width = MAX_SIDE_PX;
          }
        } else {
          if (height > MAX_SIDE_PX) {
            width = Math.round((width * MAX_SIDE_PX) / height);
            height = MAX_SIDE_PX;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context недоступен'));

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Try JPEG quality 0.70 first
        let result = canvas.toDataURL('image/jpeg', 0.70);

        // If still too large, reduce quality
        if (result.length > 1_200_000) {
          result = canvas.toDataURL('image/jpeg', 0.50);
        }
        if (result.length > 2_000_000) {
          return reject(new Error('Файл слишком большой даже после сжатия. Попробуйте другое фото.'));
        }

        resolve(result);
      } catch (err: any) {
        reject(new Error(`Ошибка Canvas: ${err.message}`));
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Не удалось декодировать изображение'));
    };

    img.src = objectUrl;
  });
};

/**
 * Legacy: compress from base64 string.
 * Prefer compressFile() for new code — it avoids the double-buffer OOM crash.
 */
export const compressImage = (base64Str: any, maxWidth = 800): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!base64Str || typeof base64Str !== 'string' || base64Str.length < 100) {
      return reject(new Error(`Некорректные данные изображения (длина: ${base64Str?.length || 0})`));
    }
    const img = new Image();

    const timeout = setTimeout(() => {
      reject(new Error('Изображение не загрузилось за 5 секунд'));
    }, 5000);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
        } else {
          if (height > maxWidth) { width = Math.round((width * maxWidth) / height); height = maxWidth; }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
        }

        let finalBase64 = canvas.toDataURL('image/jpeg', 0.6);
        if (finalBase64.length > 1300000) finalBase64 = canvas.toDataURL('image/jpeg', 0.4);
        if (finalBase64.length > 2000000) {
          reject(new Error('Файл слишком большой даже после сжатия. Попробуйте другую фото.'));
        } else {
          resolve(finalBase64);
        }
      } catch (err: any) {
        reject(new Error(`Ошибка Canvas: ${err.message}`));
      }
    };
    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Ошибка декодирования: изображение повреждено или огромного размера.'));
    };
    img.src = base64Str;
  });
};
