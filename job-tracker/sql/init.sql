-- Adds columns for tracking application status and notes
ALTER TABLE public."Jobs_List" ADD COLUMN IF NOT EXISTS applied boolean DEFAULT false;
ALTER TABLE public."Jobs_List" ADD COLUMN IF NOT EXISTS applied_at timestamptz;
ALTER TABLE public."Jobs_List" ADD COLUMN IF NOT EXISTS notes text DEFAULT '';
UPDATE public."Jobs_List" SET applied = false WHERE applied IS NULL;
ALTER TABLE public."Jobs_List" ALTER COLUMN applied SET NOT NULL;
