import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

export function QrCode({ url, className }: { url: string; className?: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(url, {
      margin: 1,
      width: 640,
      errorCorrectionLevel: 'M',
      color: { dark: '#07080c', light: '#ffffff' },
    }).then((value) => {
      if (!cancelled) setDataUrl(value);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return dataUrl ? <img className={className} src={dataUrl} alt={`QR code for ${url}`} /> : null;
}
