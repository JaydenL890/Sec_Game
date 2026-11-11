/*
# Fix sessions table for role-based auth

1. Overview
   The sessions table has a FK constraint on team_id -> teams(id) which
   prevents inserting sessions for hosts and admins (their IDs are in
   the hosts/admins tables, not teams). This migration drops that FK
   constraint and makes team_id nullable so that host/admin sessions
   can be stored with team_id = NULL and owner_type/owner_id set instead.

2. Changes
   - Drop constraint sessions_team_id_fkey
   - Alter team_id to be nullable (it was NOT NULL)
   - Existing team sessions keep their team_id; new host/admin sessions
     use owner_id + owner_type with team_id = NULL.
*/

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_team_id_fkey;
ALTER TABLE sessions ALTER COLUMN team_id DROP NOT NULL;
