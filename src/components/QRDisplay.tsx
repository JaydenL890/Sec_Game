import { QRCodeSVG } from 'qrcode.react';

export function QRDisplay({ value, size = 220 }: { value: string; size?: number }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-2xl border-4 border-gold-400 animate-pop-in">
      <QRCodeSVG value={value} size={size} level="M" includeMargin={false} />
    </div>
  );
}
