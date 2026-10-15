const cache = new Map<string, boolean>();

function hashUrl(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i += 1) {
    hash = (hash * 31 + url.charCodeAt(i)) | 0;
  }
  return String(hash);
}

function isImageDark(url: string): Promise<boolean> {
  const key = hashUrl(url);
  const cached = cache.get(key);
  if (cached !== undefined) return Promise.resolve(cached);

  return new Promise<boolean>((resolve) => {
    const loadWithCors = (useCors: boolean): void => {
      const img = new Image();
      if (useCors) img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(false);
            return;
          }
          const size = 64;
          canvas.width = size;
          canvas.height = size;
          ctx.drawImage(img, 0, 0, size, size);
          const imageData = ctx.getImageData(0, 0, size, size).data;

          let r = 0;
          let g = 0;
          let b = 0;
          let count = 0;
          for (let i = 0; i < imageData.length; i += 16) {
            r += imageData[i];
            g += imageData[i + 1];
            b += imageData[i + 2];
            count += 1;
          }
          r = Math.floor(r / count);
          g = Math.floor(g / count);
          b = Math.floor(b / count);

          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
          const dark = brightness < 128;
          cache.set(key, dark);
          resolve(dark);
        } catch {
          if (useCors) {
            loadWithCors(false);
          } else {
            resolve(false);
          }
        }
      };
      img.onerror = () => {
        if (useCors) {
          loadWithCors(false);
        } else {
          resolve(false);
        }
      };
      img.src = url;
    };
    loadWithCors(true);
  });
}

export { isImageDark };
