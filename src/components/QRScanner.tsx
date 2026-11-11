import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ScanResult {
  decodedText: string;
}

export function QRScanner({ onScan, onClose }: { onScan: (text: string) => void; onClose: () => void }) {
  const containerId = 'qr-reader';
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let mounted = true;
    const scanner = new Html5Qrcode(containerId, { verbose: false });
    scannerRef.current = scanner;

    const constraints = [
      { facingMode: { exact: 'environment' } },
      { facingMode: 'environment' },
      { video: true },
    ];

    async function tryStart() {
      for (const constraint of constraints) {
        try {
          await scanner.start(
            constraint,
            { fps: 10, qrbox: { width: 220, height: 220 } },
            (_decodedText: string, _result: ScanResult) => {
              if (mounted) {
                onScan(_decodedText);
              }
            },
            () => {},
          );
          if (mounted) setScanning(true);
          return;
        } catch (err) {
          // Try next constraint
          continue;
        }
      }
      if (mounted) setError('Could not start camera. Check permissions and try again.');
    }

    tryStart();

    return () => {
      mounted = false;
      scanner.stop().then(() => scanner.clear()).catch(() => {});
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 bg-maroon-950/95 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md festive-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-display font-bold text-gold-200 flex items-center gap-2">
            <Camera className="w-6 h-6" /> Scan Team QR
          </h2>
          <button onClick={onClose} className="text-gold-300 hover:text-gold-100">
            <X className="w-6 h-6" />
          </button>
        </div>

        {error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircle className="w-12 h-12 text-marigold-400" />
            <p className="text-gold-100 text-sm">{error}</p>
            <p className="text-gold-200/60 text-xs">Use the manual PIN entry below instead.</p>
          </div>
        ) : (
          <div className="relative rounded-xl overflow-hidden border-2 border-gold-500/40">
            <div id={containerId} className="w-full" />
            {!scanning && (
              <div className="absolute inset-0 flex items-center justify-center bg-maroon-950/80">
                <p className="text-gold-200 text-sm">Starting camera…</p>
              </div>
            )}
          </div>
        )}

        <p className="mt-4 text-center text-xs text-gold-200/60 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" /> Point at the team's QR code
        </p>
      </div>
    </div>
  );
}
