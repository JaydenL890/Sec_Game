/*
# Add team_tiles to realtime publication

## Overview
Adds the new `team_tiles` table to the Supabase realtime publication
so the frontend can subscribe to per-team board changes live.

## Changes
- Adds `public.team_tiles` to the `supabase_realtime` publication.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE public.team_tiles;
