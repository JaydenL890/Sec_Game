/*
# Fix Host-to-Station Assignments

## Overview
Three hosts were assigned to the wrong stations during setup. This migration
corrects the station_id for each misassigned host so that every host logs in
to the correct station.

## Fixes
1. HostDKC → was on "Roll Relay", should be on "Diwali Kitchen Challenge"
2. HostPTTL → was on "Deepavali Fashion", should be on "Piece Together The Light"
3. HostRollr → was on "Blooms in row", should be on "Roll Relay"

After this fix, all 8 stations have exactly one correctly-matched host.

## Notes
- Only station_id is changed; host names and PINs are preserved.
- HostBIR stays on "Blooms in row" (correct already).
- HostDF stays on "Deepavali Fashion" (correct already).
- HostLM stays on "Laser Maze" (correct already).
- HostRangoliR stays on "Rangoli Relay" (correct already).
- HostSS stays on "Silent story" (correct already).
*/

-- HostDKC → Diwali Kitchen Challenge
UPDATE hosts SET station_id = (
  SELECT id FROM stations WHERE name = 'Diwali Kitchen Challenge'
) WHERE name = 'HostDKC';

-- HostPTTL → Piece Together The Light
UPDATE hosts SET station_id = (
  SELECT id FROM stations WHERE name = 'Piece Together The Light'
) WHERE name = 'HostPTTL';

-- HostRollr → Roll Relay
UPDATE hosts SET station_id = (
  SELECT id FROM stations WHERE name = 'Roll Relay'
) WHERE name = 'HostRollr';
