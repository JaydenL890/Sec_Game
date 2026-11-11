import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { gameApi } from '@/lib/api';
import type { ShopItem } from '@/lib/types';
import { DiyaIcon, DiyaBalance } from '@/components/DiyaIcon';
import { StationIcon } from '@/components/StationIcon';
import { X, CheckCircle2, Lock } from 'lucide-react';

export function PlayerShop({
  teamId,
  sessionToken,
  balance,
  onClose,
}: {
  teamId: string;
  sessionToken: string;
  balance: number;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    supabase.from('shop_items').select('*').eq('active', true).order('price').then(({ data }) => {
      if (data) setItems(data);
    });
  }, []);

  async function handleBuy(item: ShopItem) {
    setPurchasing(item.id);
    setMessage(null);
    try {
      const result = await gameApi.purchase(teamId, item.id, sessionToken);
      setMessage({ ok: true, text: `Purchased ${result.item}! -${item.price} Diyas` });
      onClose();
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    }
    setPurchasing(null);
  }

  return (
    <div className="fixed inset-0 z-40 bg-maroon-950/90 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-lg festive-card rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-maroon-900/95 backdrop-blur-md px-5 py-4 border-b border-gold-500/20 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-display font-bold text-gold-200">Festival Shop</h2>
            <DiyaBalance amount={balance} className="text-sm" />
          </div>
          <button onClick={onClose} className="text-gold-300 hover:text-gold-100">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {message && (
            <div className={`rounded-xl px-4 py-2 text-sm text-center ${message.ok ? 'bg-jewel-900/40 text-jewel-300' : 'bg-marigold-900/40 text-marigold-300'}`}>
              {message.text}
            </div>
          )}

          {items.length === 0 ? (
            <p className="text-gold-200/50 text-center py-8">No items available</p>
          ) : (
            items.map((item) => {
              const affordable = balance >= item.price;
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3 transition ${
                    affordable
                      ? 'bg-maroon-800/50 border-gold-500/30'
                      : 'bg-maroon-950/50 border-gold-500/10 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold-400 to-marigold-500 flex items-center justify-center shrink-0">
                      <StationIcon icon={item.icon} className="w-5 h-5 text-maroon-950" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-display font-semibold text-gold-100">{item.name}</h3>
                        <span className="inline-flex items-center gap-1 text-flame-300 font-display font-bold text-sm shrink-0">
                          <DiyaIcon className="w-4 h-4" /> {item.price}
                        </span>
                      </div>
                      <p className="text-gold-200/60 text-xs mt-0.5">{item.description}</p>
                      <button
                        onClick={() => handleBuy(item)}
                        disabled={!affordable || purchasing === item.id}
                        className={`mt-2 w-full rounded-lg py-2 text-sm font-medium transition active:scale-95 ${
                          affordable
                            ? 'bg-gradient-to-br from-gold-400 to-marigold-500 text-maroon-950 font-semibold hover:brightness-110'
                            : 'bg-maroon-950/60 text-gold-200/40 cursor-not-allowed flex items-center justify-center gap-1'
                        }`}
                      >
                        {affordable ? (
                          purchasing === item.id ? 'Buying…' : 'Buy'
                        ) : (
                          <><Lock className="w-3.5 h-3.5" /> Not enough Diyas</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
