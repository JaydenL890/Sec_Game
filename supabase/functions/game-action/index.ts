import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const REWARD_MIN = 20;
const REWARD_MAX = 200;

function parseReward(value: unknown): number | null {
  const reward = Number(value);
  if (!Number.isInteger(reward) || reward < REWARD_MIN || reward > REWARD_MAX) return null;
  return reward;
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Live station capacity check ──
// Returns live occupancy data for all stations.
async function getStationCapacity(): Promise<Map<string, { maxCap: number; currentLoad: number }>> {
  await supabase.rpc("expire_stale_turns", { p_timeout_minutes: 20 });

  const { data: stations } = await supabase
    .from("stations").select("id, max_capacity");

  const { data: turnCounts } = await supabase
    .from("turns")
    .select("station_id")
    .eq("status", "pending");

  const loadMap = new Map<string, { maxCap: number; currentLoad: number }>();
  for (const s of stations ?? []) {
    loadMap.set(s.id, { maxCap: s.max_capacity, currentLoad: 0 });
  }
  for (const t of turnCounts ?? []) {
    const entry = loadMap.get(t.station_id);
    if (entry) entry.currentLoad += 1;
  }

  return loadMap;
}

// ── Capacity-aware station assignment ──
// Tries the tile's assigned station first. If it's full, redirects to another
// available station (weighted by remaining capacity). If ALL stations are full,
// returns an "all_full" signal so the caller can give a consolation bonus instead.
async function assignStation(
  teamId: string,
  preferredStationId: string | null,
): Promise<
  | { stationId: string; turnId: string; token: string }
  | { allFull: true }
  | { error: string }
> {
  const capacity = await getStationCapacity();
  if (capacity.size === 0) return { error: "No stations configured" };

  // Build station list with load info
  const stationList = Array.from(capacity.entries()).map(([id, info]) => ({
    id,
    maxCap: info.maxCap,
    currentLoad: info.currentLoad,
  }));

  // Filter available stations (not full)
  const available = stationList.filter((s) => s.currentLoad < s.maxCap);

  // If ALL stations are full, return allFull signal
  if (available.length === 0) {
    return { allFull: true };
  }

  // Try preferred station first if it's available
  const preferred = preferredStationId
    ? available.find((s) => s.id === preferredStationId)
    : null;

  // Build the pool: prefer the tile's station, fall back to other available stations
  let pool: typeof available;
  if (preferred) {
    // 70% chance to try the preferred station, 30% to pick another (prevents all teams clustering)
    pool = Math.random() < 0.7 ? [preferred] : available;
  } else {
    pool = available;
  }

  // Weight by remaining capacity (less busy = more likely)
  const weighted = pool.map((s) => ({
    ...s,
    weight: Math.max(s.maxCap - s.currentLoad, 1),
  }));

  // Try up to 3 different stations (in case of race conditions on the last slot)
  for (let attempt = 0; attempt < 3; attempt++) {
    // Re-check capacity on retries
    if (attempt > 0) {
      const freshCapacity = await getStationCapacity();
      const freshAvailable = stationList.filter((s) => {
        const c = freshCapacity.get(s.id);
        return c && c.currentLoad < c.maxCap;
      });
      if (freshAvailable.length === 0) return { allFull: true };

      const freshWeighted = freshAvailable.map((s) => ({
        ...s,
        weight: Math.max(s.maxCap - (freshCapacity.get(s.id)?.currentLoad ?? 0), 1),
      }));
      weighted.length = 0;
      weighted.push(...freshWeighted);
    }

    const total = weighted.reduce((sum, w) => sum + w.weight, 0);
    let rand = Math.random() * total;
    let chosen = weighted[weighted.length - 1];
    for (const w of weighted) {
      if (rand < w.weight) { chosen = w; break; }
      rand -= w.weight;
    }

    const token = randomToken();
    const { data: turnId, error } = await supabase.rpc("try_reserve_station_slot", {
      p_station_id: chosen.id,
      p_team_id: teamId,
      p_token: token,
    });

    if (error || !turnId) {
      // Slot was taken by another team — retry with a different station
      continue;
    }

    return { stationId: chosen.id, turnId, token };
  }

  // All retries failed — check if stations are still available at all
  const finalCheck = await getStationCapacity();
  const stillAvailable = stationList.filter((s) => {
    const c = finalCheck.get(s.id);
    return c && c.currentLoad < c.maxCap;
  });
  if (stillAvailable.length === 0) {
    return { allFull: true };
  }

  return { error: "Could not assign a station — all stations are at capacity. Try again in a moment." };
}

// ── Get team's board tiles (per-team layout, falling back to base tiles) ──
async function getTeamTiles(teamId: string) {
  // Try team-specific tiles first
  const { data: teamTiles } = await supabase
    .from("team_tiles")
    .select("*")
    .eq("team_id", teamId)
    .order("tile_order");

  if (teamTiles && teamTiles.length > 0) {
    return teamTiles;
  }

  // Fall back to base tiles (and generate team tiles for next time)
  const { data: baseTiles } = await supabase
    .from("tiles")
    .select("*")
    .order("tile_order");

  // Generate team board in the background if not exists
  await supabase.rpc("generate_team_board", { p_team_id: teamId });

  return baseTiles ?? [];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.pathname.replace("/game-action", "").replace(/^\//, "");
    const body = await req.json().catch(() => ({}));

    // ── TEAM REGISTER ──
    if (action === "team-register") {
      const { name, pin, color, memberNames } = body;
      if (!name || !pin) return json({ error: "Team name and PIN are required" }, 400);
      if (String(pin).length < 4) return json({ error: "PIN must be at least 4 characters" }, 400);
      const members = Array.isArray(memberNames)
        ? memberNames.map((m) => String(m ?? "").trim()).filter(Boolean)
        : [];
      if (members.length === 0) return json({ error: "At least one team member name is required" }, 400);
      if (members.length > 10) return json({ error: "A team can have at most 10 members" }, 400);
      if (members.some((m) => m.length > 40)) return json({ error: "Team member names must be 40 characters or fewer" }, 400);

      const { data, error } = await supabase.rpc("team_register", {
        p_name: String(name).trim(),
        p_pin: String(pin),
        p_color: color || "amber",
        p_member_names: members,
      });

      if (error || !data || data.length === 0 || !data[0].team_id) {
        return json({ error: "That team name is already taken. Try another name or log in." }, 400);
      }

      // Generate per-team board
      await supabase.rpc("generate_team_board", { p_team_id: data[0].team_id });

      return json({ teamId: data[0].team_id, sessionToken: data[0].session_token });
    }

    // ── TEAM LOGIN ──
    if (action === "team-login") {
      const { name, pin } = body;
      if (!name || !pin) return json({ error: "Team name and PIN are required" }, 400);

      const { data, error } = await supabase.rpc("team_login", {
        p_name: String(name).trim(),
        p_pin: String(pin),
      });

      if (error || !data || data.length === 0 || !data[0].team_id) {
        return json({ error: "Incorrect team name or PIN" }, 400);
      }

      // Ensure team has a board (for existing teams pre-migration)
      await supabase.rpc("generate_team_board", { p_team_id: data[0].team_id });

      return json({ teamId: data[0].team_id, sessionToken: data[0].session_token });
    }

    // ── HOST LOGIN ──
    if (action === "host-login") {
      const { name, pin } = body;
      if (!name || !pin) return json({ error: "Host name and PIN are required" }, 400);

      const { data, error } = await supabase.rpc("host_login", {
        p_name: String(name).trim(),
        p_pin: String(pin),
      });

      if (error || !data || data.length === 0 || !data[0].host_id) {
        return json({ error: "Invalid host name or PIN" }, 400);
      }

      return json({
        hostId: data[0].host_id,
        stationId: data[0].station_id,
        sessionToken: data[0].session_token,
      });
    }

    // ── ADMIN LOGIN ──
    if (action === "admin-login") {
      const { username, pin } = body;
      if (!username) return json({ error: "Username is required" }, 400);
      if (!pin) return json({ error: "PIN is required" }, 400);

      const { data, error } = await supabase.rpc("admin_login", {
        p_username: String(username).trim(),
        p_pin: String(pin),
      });

      if (error || !data || data.length === 0 || !data[0].admin_id) {
        return json({ error: "Invalid admin credentials" }, 400);
      }

      return json({
        adminId: data[0].admin_id,
        sessionToken: data[0].session_token,
      });
    }

    // ── ADMIN RESET TEAM PIN ──
    if (action === "reset-pin") {
      const { teamId, newPin } = body;
      if (!teamId || !newPin) return json({ error: "Missing teamId or newPin" }, 400);
      if (String(newPin).length < 4) return json({ error: "PIN must be at least 4 characters" }, 400);

      const { data, error } = await supabase.rpc("reset_team_pin", {
        p_team_id: teamId,
        p_new_pin: String(newPin),
      });

      if (error || !data) {
        return json({ error: "Could not reset PIN" }, 500);
      }

      return json({ success: true });
    }

    // ── ROLL DICE ──
    if (action === "roll") {
      const { teamId, sessionToken } = body;
      if (!teamId) return json({ error: "Missing teamId" }, 400);

      // Validate session if token provided
      if (sessionToken) {
        const { data: validId } = await supabase.rpc("validate_session", { p_token: sessionToken });
        if (!validId || validId !== teamId) {
          return json({ error: "Session expired — please log in again" }, 401);
        }
      }

      const { data: team } = await supabase
        .from("teams").select("*").eq("id", teamId).maybeSingle();
      if (!team) return json({ error: "Team not found" }, 404);
      if (team.status === "pending" || team.status === "traveling")
        return json({ error: "You have a pending station visit" }, 400);
      if (team.status === "resting")
        return json({ error: "You are resting — skip this turn" }, 400);

      const { data: cfg } = await supabase
        .from("game_config").select("*").eq("id", 1).maybeSingle();
      if (cfg && cfg.status !== "running")
        return json({ error: "Game is not running" }, 400);

      // Use per-team board tiles
      const tiles = await getTeamTiles(teamId);
      if (!tiles || tiles.length === 0) return json({ error: "Board not configured" }, 400);

      const dice = Math.floor(Math.random() * 6) + 1;
      const newPos = (team.board_position + dice) % tiles.length;
      const tile = tiles.find((t) => t.tile_order === newPos)!;
      const passedStart = newPos < team.board_position || (team.board_position + dice) >= tiles.length;

      let newStatus = "idle";
      let stationId: string | null = null;
      let turnId: string | null = null;
      let token: string | null = null;
      let specialResult: { type: string; text: string; amount: number } | null = null;

      if (tile.type === "station" && tile.station_id) {
        // ── Capacity-aware assignment using per-team board ──
        // Try the tile's assigned station first; if full, redirect to another available station.
        // If ALL stations are full, give a consolation bonus instead.
        const result = await assignStation(teamId, tile.station_id);

        if ("error" in result) {
          return json({ error: result.error }, 400);
        }

        if ("allFull" in result) {
          // All stations are full — give a consolation bonus and stay idle
          const consolation = 15;
          await supabase.from("transactions").insert({
            team_id: teamId, amount: consolation, type: "special",
            note: "All stations were busy — consolation bonus!",
          });
          const { data: updated } = await supabase
            .from("teams").update({ balance: team.balance + consolation }).eq("id", teamId).select("*").single();
          team.balance = updated.balance;

          specialResult = {
            type: "all_full",
            text: "All stations are busy right now! You earn a consolation bonus. Try rolling again next turn.",
            amount: consolation,
          };
        } else {
          stationId = result.stationId;
          turnId = result.turnId;
          token = result.token;
          newStatus = "pending";
        }
      } else if (tile.type === "start") {
        const bonus = cfg?.lap_bonus ?? 50;
        await supabase.from("transactions").insert({
          team_id: teamId, amount: bonus, type: "lap", note: "Landed on Diwali Gate",
        });
        const { data: updated } = await supabase
          .from("teams").update({ balance: team.balance + bonus }).eq("id", teamId).select("*").single();
        team.balance = updated.balance;
      }

      // Apply lap bonus if passed start
      if (passedStart && tile.type !== "start") {
        const bonus = cfg?.lap_bonus ?? 50;
        await supabase.from("transactions").insert({
          team_id: teamId, amount: bonus, type: "lap", note: "Passed Diwali Gate",
        });
        const { data: updated } = await supabase
          .from("teams").update({ balance: team.balance + bonus }).eq("id", teamId).select("*").single();
        team.balance = updated.balance;
      }

      // Update team position. If assigned to a station, use the station's tile
      // position on the team's own board for display.
      let displayPos = newPos;
      if (stationId) {
        const stationTile = tiles.find((t) => t.station_id === stationId);
        if (stationTile) displayPos = stationTile.tile_order;
      }

      await supabase.from("teams").update({
        board_position: displayPos,
        status: newStatus,
      }).eq("id", teamId);

      // Fetch station details for the response
      let stationName: string | null = null;
      let stationPhrase: string | null = null;
      let stationLocation: string | null = null;
      let stationIcon: string | null = null;
      if (stationId) {
        const { data: st } = await supabase
          .from("stations").select("*").eq("id", stationId).maybeSingle();
        if (st) {
          stationName = st.name;
          stationPhrase = st.phrase;
          stationLocation = st.location_hint;
          stationIcon = st.icon;
        }
      }

      return json({
        dice,
        newPosition: displayPos,
        tileType: tile.type,
        stationId,
        stationName,
        stationPhrase,
        stationLocation,
        stationIcon,
        turnId,
        token,
        specialResult,
        newBalance: team.balance,
        passedStart,
      });
    }

    // ── SCAN / VERIFY QR ──
    if (action === "scan") {
      const { token, hostId, reward: requestedReward } = body;
      if (!token || !hostId) return json({ error: "Missing token or hostId" }, 400);
      const reward = parseReward(requestedReward);
      if (reward === null) return json({ error: "Choose a reward between 20 and 200 Diyas" }, 400);

      // Expire stale turns first
      await supabase.rpc("expire_stale_turns", { p_timeout_minutes: 20 });

      const { data: host } = await supabase
        .from("hosts").select("*").eq("id", hostId).maybeSingle();
      if (!host) return json({ error: "Host not found" }, 404);

      const { data: turn } = await supabase
        .from("turns").select("*").eq("token", token).maybeSingle();
      if (!turn) return json({ error: "Invalid QR code" }, 400);
      if (turn.status !== "pending")
        return json({ error: "This QR code has already been used" }, 400);
      if (turn.station_id !== host.station_id)
        return json({ error: "Wrong station — this team belongs to a different station" }, 400);

      // Check expiry (60 min)
      const ageMin = (Date.now() - new Date(turn.created_at).getTime()) / 60000;
      if (ageMin > 60) {
        await supabase.from("turns").update({ status: "expired" }).eq("id", turn.id);
        return json({ error: "This QR code has expired" }, 400);
      }

      const { data: station } = await supabase
        .from("stations").select("*").eq("id", turn.station_id).maybeSingle();
      if (!station) return json({ error: "Station not found" }, 404);

      const { data: team } = await supabase
        .from("teams").select("*").eq("id", turn.team_id).maybeSingle();
      if (!team) return json({ error: "Team not found" }, 404);

      await supabase.from("transactions").insert({
        team_id: team.id, amount: reward, type: "station",
        note: `Reward at ${station.name}`,
      });
      await supabase.from("teams").update({
        balance: team.balance + reward,
        status: "idle",
      }).eq("id", team.id);

      await supabase.from("turns").update({
        status: "completed",
        reward,
        completed_at: new Date().toISOString(),
      }).eq("id", turn.id);

      return json({
        success: true,
        teamName: team.name,
        stationName: station.name,
        reward,
      });
    }

    // ── MANUAL PIN VERIFY (fallback) ──
    if (action === "pin-verify") {
      const { pin, hostId, reward: requestedReward } = body;
      if (!pin || !hostId)
        return json({ error: "Missing PIN or hostId" }, 400);
      const reward = parseReward(requestedReward);
      if (reward === null) return json({ error: "Choose a reward between 20 and 200 Diyas" }, 400);

      // Expire stale turns first
      await supabase.rpc("expire_stale_turns", { p_timeout_minutes: 20 });

      const { data: host } = await supabase
        .from("hosts").select("*").eq("id", hostId).maybeSingle();
      if (!host) return json({ error: "Host not found" }, 404);

      const pinLower = String(pin).toLowerCase();
      const { data: pendingTurns } = await supabase
        .from("turns").select("*")
        .eq("station_id", host.station_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50);
      const turn = (pendingTurns ?? []).find((t) =>
        t.token.slice(0, 8).toLowerCase() === pinLower,
      );
      if (!turn) return json({ error: "No pending turn found for this PIN at this station" }, 400);

      const { data: station } = await supabase
        .from("stations").select("*").eq("id", turn.station_id).maybeSingle();
      const { data: team } = await supabase
        .from("teams").select("*").eq("id", turn.team_id).maybeSingle();
      if (!station || !team) return json({ error: "Data error" }, 500);

      await supabase.from("transactions").insert({
        team_id: team.id, amount: reward, type: "station",
        note: `Reward at ${station.name} (PIN)`,
      });
      await supabase.from("teams").update({
        balance: team.balance + reward, status: "idle",
      }).eq("id", team.id);
      await supabase.from("turns").update({
        status: "completed", reward,
        completed_at: new Date().toISOString(),
      }).eq("id", turn.id);

      return json({
        success: true, teamName: team.name, stationName: station.name,
        reward,
      });
    }

    // ── SHOP PURCHASE ──
    if (action === "purchase") {
      const { teamId, shopItemId, sessionToken } = body;
      if (!teamId || !shopItemId) return json({ error: "Missing parameters" }, 400);

      if (sessionToken) {
        const { data: validId } = await supabase.rpc("validate_session", { p_token: sessionToken });
        if (!validId || validId !== teamId) {
          return json({ error: "Session expired — please log in again" }, 401);
        }
      }

      const { data: team } = await supabase
        .from("teams").select("*").eq("id", teamId).maybeSingle();
      if (!team) return json({ error: "Team not found" }, 404);

      const { data: item } = await supabase
        .from("shop_items").select("*").eq("id", shopItemId).maybeSingle();
      if (!item) return json({ error: "Item not found" }, 404);
      if (!item.active) return json({ error: "Item not available" }, 400);
      if (team.balance < item.price)
        return json({ error: "Not enough Diyas" }, 400);

      await supabase.from("transactions").insert({
        team_id: teamId, amount: -item.price, type: "shop",
        note: `Purchased ${item.name}`,
      });
      await supabase.from("purchases").insert({
        team_id: teamId, shop_item_id: shopItemId, price_paid: item.price,
      });
      await supabase.from("teams").update({
        balance: team.balance - item.price,
      }).eq("id", teamId);

      return json({ success: true, newBalance: team.balance - item.price, item: item.name });
    }

    // ── ADMIN ADJUST BALANCE ──
    if (action === "adjust") {
      const { teamId, amount, reason } = body;
      if (!teamId || amount === undefined) return json({ error: "Missing parameters" }, 400);

      const { data: team } = await supabase
        .from("teams").select("*").eq("id", teamId).maybeSingle();
      if (!team) return json({ error: "Team not found" }, 404);

      const newBal = Math.max(0, team.balance + amount);
      await supabase.from("transactions").insert({
        team_id: teamId, amount, type: "adjustment",
        note: reason || "Admin adjustment",
      });
      await supabase.from("teams").update({ balance: newBal }).eq("id", teamId);

      return json({ success: true, newBalance: newBal });
    }

    // ── PAY TO SKIP REST ──
    if (action === "skip-rest") {
      const { teamId, sessionToken } = body;
      if (!teamId) return json({ error: "Missing teamId" }, 400);

      if (sessionToken) {
        const { data: validId } = await supabase.rpc("validate_session", { p_token: sessionToken });
        if (!validId || validId !== teamId) {
          return json({ error: "Session expired — please log in again" }, 401);
        }
      }

      const { data: team } = await supabase
        .from("teams").select("*").eq("id", teamId).maybeSingle();
      if (!team) return json({ error: "Team not found" }, 404);
      if (team.status !== "resting") return json({ error: "Not resting" }, 400);
      const fee = 15;
      if (team.balance < fee) return json({ error: "Not enough Diyas to skip rest" }, 400);
      await supabase.from("transactions").insert({
        team_id: teamId, amount: -fee, type: "special", note: "Paid to skip Rangoli Rest",
      });
      await supabase.from("teams").update({
        balance: team.balance - fee, status: "idle",
      }).eq("id", teamId);
      return json({ success: true, newBalance: team.balance - fee });
    }

    // ── CLEAR REST (free, after one missed turn) ──
    if (action === "clear-rest") {
      const { teamId, sessionToken } = body;
      if (!teamId) return json({ error: "Missing teamId" }, 400);

      if (sessionToken) {
        const { data: validId } = await supabase.rpc("validate_session", { p_token: sessionToken });
        if (!validId || validId !== teamId) {
          return json({ error: "Session expired — please log in again" }, 401);
        }
      }

      await supabase.from("teams").update({ status: "idle" }).eq("id", teamId);
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 404);
  } catch (err) {
    return json({ error: (err as Error).message || "Server error" }, 500);
  }
});
