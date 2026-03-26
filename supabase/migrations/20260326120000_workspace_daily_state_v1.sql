BEGIN;

CREATE TABLE IF NOT EXISTS public.workspace_daily_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day date NOT NULL,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  life_data jsonb NOT NULL,
  analytics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_daily_state_unique_user_day UNIQUE (user_id, day)
);

CREATE TABLE IF NOT EXISTS public.workspace_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (
    event_type IN ('challenge_start', 'challenge_complete', 'section_open')
  ),
  section_key text NULL CHECK (
    section_key IS NULL OR section_key IN ('religious', 'study', 'career', 'health', 'personal')
  ),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_daily_state_user_day
  ON public.workspace_daily_state(user_id, day DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_events_user_created
  ON public.workspace_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_events_type_created
  ON public.workspace_events(event_type, created_at DESC);

ALTER TABLE public.workspace_daily_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own workspace daily state" ON public.workspace_daily_state;
CREATE POLICY "Users can view own workspace daily state"
  ON public.workspace_daily_state
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own workspace daily state" ON public.workspace_daily_state;
CREATE POLICY "Users can create own workspace daily state"
  ON public.workspace_daily_state
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own workspace daily state" ON public.workspace_daily_state;
CREATE POLICY "Users can update own workspace daily state"
  ON public.workspace_daily_state
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own workspace daily state" ON public.workspace_daily_state;
CREATE POLICY "Users can delete own workspace daily state"
  ON public.workspace_daily_state
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own workspace events" ON public.workspace_events;
CREATE POLICY "Users can view own workspace events"
  ON public.workspace_events
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own workspace events" ON public.workspace_events;
CREATE POLICY "Users can create own workspace events"
  ON public.workspace_events
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own workspace events" ON public.workspace_events;
CREATE POLICY "Users can delete own workspace events"
  ON public.workspace_events
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_workspace_daily_state_updated_at ON public.workspace_daily_state;
CREATE TRIGGER trg_workspace_daily_state_updated_at
  BEFORE UPDATE ON public.workspace_daily_state
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

COMMIT;

