-- FreeFrame Review Studio V2: after schema.sql, google-drive-migration.sql,
-- and media-library-migration.sql. Safe to rerun.
ALTER TABLE public.asset_versions ADD COLUMN IF NOT EXISTS duration_seconds numeric(12,3) CHECK (duration_seconds>0);
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS annotation jsonb;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.comments(id) ON DELETE SET NULL;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='freeframe_annotation_max_size') THEN
   ALTER TABLE public.comments ADD CONSTRAINT freeframe_annotation_max_size
    CHECK (annotation IS NULL OR (jsonb_typeof(annotation)='array' AND jsonb_array_length(annotation)<=25 AND pg_column_size(annotation)<=30000));
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS comments_thread_idx ON public.comments(parent_id) WHERE parent_id IS NOT NULL;
-- Prevent cross-project or cross-version replies, even from an authenticated reviewer.
CREATE OR REPLACE FUNCTION public.validate_freeframe_reply() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE parent_version uuid; parent_project uuid;
BEGIN
 IF new.parent_id IS NOT NULL THEN
  SELECT asset_version_id,project_id INTO parent_version,parent_project FROM public.comments WHERE id=new.parent_id;
  IF parent_version IS NULL OR parent_version<>new.asset_version_id OR parent_project<>new.project_id THEN
   RAISE EXCEPTION 'Reply must belong to the same project and video version';
  END IF;
  IF new.id=new.parent_id THEN RAISE EXCEPTION 'Comment cannot reply to itself'; END IF;
 END IF;
 RETURN new;
END $$;
DROP TRIGGER IF EXISTS validate_freeframe_reply_trg ON public.comments;
CREATE TRIGGER validate_freeframe_reply_trg BEFORE INSERT OR UPDATE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.validate_freeframe_reply();
-- No new RLS grants: project members can insert comments via existing policy,
-- guest comments go through the validated server API, editor resolve via /api/comments/resolve.
