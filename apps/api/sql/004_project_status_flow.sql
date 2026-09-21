-- 项目状态流转：阶段门、回退原因、自动推进一次性标记与流转历史

ALTER TABLE projects ADD COLUMN auto_started boolean NOT NULL DEFAULT false;

CREATE TABLE project_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_status project_status,
  to_status project_status NOT NULL,
  transition_kind varchar(16) NOT NULL CHECK (transition_kind IN ('FORWARD', 'BACKWARD', 'ARCHIVE', 'AUTO_START')),
  reason text,
  gate_skipped boolean NOT NULL DEFAULT false,
  actor_user_id uuid REFERENCES users(id),
  request_id varchar(64),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (transition_kind <> 'BACKWARD' OR reason IS NOT NULL)
);
CREATE INDEX project_status_history_project_idx ON project_status_history(project_id, created_at);

ALTER TABLE project_requirements ADD COLUMN version integer NOT NULL DEFAULT 1;
