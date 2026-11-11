import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ShopItem, Team, RiddleChallenge } from '@/lib/types';

const RIDDLE_POOL = [
  { question: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", answer: "echo" },
  { question: "The more of me you take, the more you leave behind. What am I?", answer: "footsteps" },
  { question: "What has keys, but no locks; space, but no room; and you can enter, but not go in?", answer: "keyboard" },
  { question: "What gets wetter the more it dries?", answer: "towel" },
];

interface ShopPanelProps {
  shopItems: ShopItem[];
  teams: Team[];
  currentTeamId: string;
  onRefresh: () => void;
}

export function ShopPanel({ shopItems, teams, currentTeamId, onRefresh }: ShopPanelProps) {
  const [selectedCard, setSelectedCard] = useState<ShopItem | null>(null);
  const [targetTeamId, setTargetTeamId] = useState<string>('');
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const currentTeam = teams.find((t) => t.id === currentTeamId);
  const opposingTeams = teams.filter((t) => t.id !== currentTeamId);

  const handleBuyItem = (item: ShopItem) => {
    if (!currentTeam || currentTeam.score < item.price) {
      alert("Not enough points!");
      return;
    }

    const isRiddleCard = item.name.toLowerCase().includes('riddle') || item.name.toLowerCase().includes('trap');

    if (isRiddleCard) {
      setSelectedCard(item);
      setIsTargetModalOpen(true);
    }
  };

  const handleConfirmAttack = async () => {
    if (!selectedCard || !targetTeamId || !currentTeam) return;

    setLoading(true);
    try {
      const targetTeam = teams.find((t) => t.id === targetTeamId);
      if (!targetTeam) return;

      const randomRiddle = RIDDLE_POOL[Math.floor(Math.random() * RIDDLE_POOL.length)];

      const riddlePayload: RiddleChallenge = {
        riddle_id: crypto.randomUUID(),
        attacker_team_name: currentTeam.name,
        question: randomRiddle.question,
        answer: randomRiddle.answer.toLowerCase().trim(),
        penalty_points: 20,
      };

      await supabase
        .from('teams')
        .update({ score: currentTeam.score - selectedCard.price })
        .eq('id', currentTeamId);

      await supabase
        .from('teams')
        .update({ pending_riddle: riddlePayload })
        .eq('id', targetTeamId);

      await supabase.from('transactions').insert({
        team_id: currentTeamId,
        type: 'power_card_riddle',
        amount: -selectedCard.price,
        description: `Sent a riddle challenge to ${targetTeam.name}`,
      });

      setIsTargetModalOpen(false);
      setSelectedCard(null);
      setTargetTeamId('');
      onRefresh();
      alert(`Riddle challenge sent to ${targetTeam.name}!`);
    } catch (err) {
      console.error(err);
      alert('Failed to launch attack.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gold-100">Item Shop</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {shopItems.map((item) => (
          <div key={item.id} className="bg-maroon-900/40 border border-gold-500/20 p-4 rounded-xl flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-gold-200">{item.name}</h3>
              <p className="text-sm text-gold-300/70">{item.description}</p>
              <span className="text-xs bg-gold-500/20 text-gold-300 px-2 py-0.5 rounded font-medium mt-2 inline-block">
                {item.price} pts
              </span>
            </div>
            <button onClick={() => handleBuyItem(item)} className="btn-primary px-4 py-2 text-sm">
              Buy
            </button>
          </div>
        ))}
      </div>

      {isTargetModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-maroon-950 border border-gold-500/30 rounded-2xl max-w-md w-full p-6 text-gold-100 shadow-2xl">
            <h3 className="text-lg font-bold text-gold-300 mb-2">Target a Team</h3>
            <p className="text-sm text-gold-300/70 mb-4">Choose which team must solve a riddle to proceed:</p>

            <div className="space-y-2 mb-6">
              {opposingTeams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => setTargetTeamId(team.id)}
                  className={`w-full text-left p-3 rounded-lg border transition ${
                    targetTeamId === team.id
                      ? 'bg-gold-500/20 border-gold-400 text-white font-semibold'
                      : 'bg-maroon-900/50 border-gold-500/20 hover:border-gold-500/50'
                  }`}
                >
                  <div className="flex justify-between">
                    <span>{team.name}</span>
                    <span className="text-gold-300/70">{team.score} pts</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsTargetModalOpen(false)}
                className="flex-1 bg-maroon-900 hover:bg-maroon-800 text-gold-200 py-2 rounded-lg font-medium border border-gold-500/20"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAttack}
                disabled={!targetTeamId || loading}
                className="flex-1 bg-gradient-to-br from-gold-400 to-marigold-500 text-maroon-950 font-bold py-2 rounded-lg disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Riddle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}