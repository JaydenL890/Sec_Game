import { Dices } from 'lucide-react';

export function Dice({ value, rolling }: { value: number; rolling: boolean }) {
  const pips: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };

  const positions = [
    'col-start-1 row-start-1', 'col-start-2 row-start-1', 'col-start-3 row-start-1',
    'col-start-1 row-start-2', 'col-start-2 row-start-2', 'col-start-3 row-start-2',
    'col-start-1 row-start-3', 'col-start-2 row-start-3', 'col-start-3 row-start-3',
  ];

  return (
    <div
      className={`relative grid grid-cols-3 grid-rows-3 gap-1 rounded-2xl bg-gradient-to-br from-gold-100 to-gold-200 p-3 shadow-xl border-2 border-gold-400 ${
        rolling ? 'animate-dice-roll' : 'animate-pop-in'
      }`}
      style={{ width: 'clamp(80px, 30vw, 120px)', height: 'clamp(80px, 30vw, 120px)' }}
    >
      {rolling ? (
        <div className="col-span-3 row-span-3 flex items-center justify-center">
          <Dices className="w-12 h-12 text-maroon-700 animate-spin" />
        </div>
      ) : (
        positions.map((pos, i) => (
          <div key={i} className={`${pos} flex items-center justify-center`}>
            {pips[value]?.includes(i) && (
              <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-maroon-800 shadow-inner" />
            )}
          </div>
        ))
      )}
    </div>
  );
}
