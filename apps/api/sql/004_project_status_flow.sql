-- 项目状态流转：阶段门、回退原因与一次性自动推进

-- 记录项目是否已被消耗自动推进过（自动推进只能触发一次）
ALTER TABLE projects ADD COLUMN auto_started_at timestamptz;

-- 材料需求乐观锁版本号
ALTER TABLE project_requirements ADD COLUMN version integer NOT NULL DEFAULT 1;

-- 状态流转记录：回退必须携带原因，自动推进每项目最多一条
CREATE TABLE project_status_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  from_status project_status NOT NULL,
  to_status project_status NOT NULL,
  trigger_type varchar(8) NOT NULL DEFAULT 'MANUAL' CHECK (trigger_type IN ('MANUAL', 'AUTO')),
  reason text,
  actor_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_status <> to_status),
  -- 自动推进只允许 PLANNED -> IN_PROGRESS
  CHECK (trigger_type <> 'AUTO' OR (from_status = 'PLANNED' AND to_status = 'IN_PROGRESS')),
  -- 手动回退（目标状态小于源状态）必须填写至少 3 个字符的回退原因
  CHECK (trigger_type = 'AUTO' OR to_status > from_status OR (reason IS NOT NULL AND length(trim(reason)) >= 3))
);
CREATE INDEX project_status_transitions_project_idx ON project_status_transitions(project_id, created_at DESC);
-- 自动推进只能触发一次（数据库级兜底）
CREATE UNIQUE INDEX project_status_transitions_auto_uq ON project_status_transitions(project_id) WHERE trigger_type = 'AUTO';
