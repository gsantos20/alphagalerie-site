// src/components/checkout/PixPayment.tsx
import { useEffect, useRef, useState } from 'react';
import { formatCurrency as fmt } from '../../lib/format';

interface PixPaymentProps {
  total: number;
  txid: string;
  onClose: () => void;
}

const PIX_KEY = import.meta.env.VITE_PIX_KEY as string;
const PIX_NAME = (import.meta.env.VITE_PIX_NAME as string) ?? 'Alpha Galerie';
const PIX_CITY = (import.meta.env.VITE_PIX_CITY as string) ?? 'Barueri';

function crc16(str: string): number {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return crc & 0xffff;
}

function buildPixPayload(amount: number, txid: string): string {
  function field(id: string, value: string): string {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
  }

  const gui = field('00', 'BR.GOV.BCB.PIX');
  const keyField = field('01', PIX_KEY);
  const merchantAccountInfo = field('26', gui + keyField);
  const amountStr = amount.toFixed(2);
  const txidClean = txid.replace(/\W/g, '').slice(0, 25) || '***';

  const payload =
    field('00', '01') +
    merchantAccountInfo +
    field('52', '0000') +
    field('53', '986') +
    field('54', amountStr) +
    field('58', 'BR') +
    field('59', PIX_NAME.slice(0, 25)) +
    field('60', PIX_CITY.slice(0, 15)) +
    field('62', field('05', txidClean)) +
    '6304';

  return payload + crc16(payload).toString(16).toUpperCase().padStart(4, '0');
}

export default function PixPayment({ total, txid, onClose }: PixPaymentProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [qrError, setQrError] = useState(false);

  const pixPayload = buildPixPayload(total, txid);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const QRCode = await import('qrcode');
        if (!cancelled && canvasRef.current) {
          await QRCode.toCanvas(canvasRef.current, pixPayload, {
            width: 200,
            margin: 1,
            color: { dark: '#000000', light: '#ffffff' },
          });
        }
      } catch {
        if (!cancelled) setQrError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [pixPayload]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(PIX_KEY);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // silent fallback
    }
  }

  // Use shared cached formatter

  return (
    <div style={{ padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
      <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.5rem', color: '#c9a961', margin: 0, letterSpacing: '0.06em' }}>
        Pagamento via PIX
      </h3>

      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.5rem', fontWeight: 700, color: '#f4f4f4', margin: 0 }}
         aria-label={`Valor: ${fmt(total)}`}>
        {fmt(total)}
      </p>

      <div style={{ background: '#fff', padding: '0.75rem', borderRadius: 4 }}>
        {qrError ? (
          <p style={{ color: '#333', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', margin: 0 }}>
            Não foi possível gerar o QR Code.
          </p>
        ) : (
          <canvas ref={canvasRef} aria-label="QR Code PIX" />
        )}
      </div>

      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <label htmlFor="pix-key-display" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(244,244,244,0.5)', textTransform: 'uppercase' }}>
          Chave PIX
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            id="pix-key-display"
            type="text"
            readOnly
            value={PIX_KEY}
            aria-label="Chave PIX para copiar"
            style={{ flex: 1, padding: '0.625rem 0.75rem', background: '#111', border: '1px solid rgba(244,244,244,0.1)', color: '#f4f4f4', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', borderRadius: 2 }}
          />
          <button
            type="button"
            aria-label="Copiar chave PIX"
            onClick={handleCopy}
            style={{ padding: '0.625rem 1rem', background: copied ? 'rgba(201,169,97,0.2)' : 'transparent', border: '1px solid rgba(201,169,97,0.5)', color: '#c9a961', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', cursor: 'pointer', borderRadius: 2, whiteSpace: 'nowrap' }}
          >
            {copied ? 'Copiado!' : 'Copiar chave'}
          </button>
        </div>
      </div>

      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: 'rgba(244,244,244,0.45)', margin: 0, textAlign: 'center', lineHeight: 1.6 }}>
        Após o pagamento, envie o comprovante pelo WhatsApp.
      </p>

      <button
        type="button"
        aria-label="Fechar pagamento PIX"
        onClick={onClose}
        style={{ width: '100%', padding: '1rem', background: '#c9a961', color: '#0a0a0a', border: 'none', fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 2 }}
      >
        Fechar
      </button>
    </div>
  );
}
