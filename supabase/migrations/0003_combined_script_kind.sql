-- Adds combined_script to generations.kind's allowed values. Doesn't
-- remove video_script/shooting_script from the check — existing rows with
-- those kinds must stay valid, and apps/web's ResultCard.tsx still renders
-- them for old history entries. The brainstorm UI's action buttons just
-- stopped offering those two as new-generation choices (see
-- Dashboard.tsx's ACTION_KINDS) in favor of one combined script+shots
-- generator (apps/api/app/combined_script.py).

alter table generations drop constraint if exists generations_kind_check;

alter table generations add constraint generations_kind_check
  check (kind in ('video_script', 'shooting_script', 'content_idea', 'combined_script'));
