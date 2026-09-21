import type { Pool, PoolClient } from "pg";
import { projectStatusRank, projectStatusTransitions, type ProjectStatus, type ProjectTransitionKind } from "@handcraft/contracts";
import { AppError } from "./errors.js";

type Queryable = Pick<Pool | PoolClient, "query">;

export type ProjectRow = {
  id: string;
  status: ProjectStatus;
  version: number;
  start_date: string | null;
  due_date: string | null;
  auto_started: boolean;
};

/** 流转方向：仅 PLANNED <-> IN_PROGRESS <-> COMPLETED 之间比较阶段序号 */
export function transitionKind(from: ProjectStatus, to: ProjectStatus): ProjectTransitionKind {
  if (to === "ARCHIVED") return "ARCHIVE";
  return projectStatusRank[to] > projectStatusRank[from] ? "FORWARD" : "BACKWARD";
}

/** 阶段门：校验状态跃迁是否合法（归档走独立接口，不在此校验） */
export function assertTransitionAllowed(from: ProjectStatus, to: ProjectStatus): void {
  if (to === "ARCHIVED") {
    throw new AppError(422, "USE_ARCHIVE_ENDPOINT", "归档项目必须使用专门的归档接口");
  }
  const allowed: readonly ProjectStatus[] = projectStatusTransitions[from];
  if (!allowed.includes(to)) {
    throw new AppError(409, "INVALID_STATUS_TRANSITION", `项目不能从${from}直接变更为${to}，请按阶段顺序流转`);
  }
}

export type GateCheck = { code: string; message: string };

/**
 * 阶段门前置条件：
 * - 开始项目：截止日期不能早于今天
 * - 完成项目：至少存在一条有效（未撤销）材料消耗
 */
export async function checkPhaseGate(
  client: Queryable,
  project: Pick<ProjectRow, "id" | "due_date">,
  to: ProjectStatus
): Promise<GateCheck | null> {
  if (to === "IN_PROGRESS") {
    if (!project.due_date) return null;
    const today = await client.query<{ today: string }>("SELECT current_date::text AS today");
    if (project.due_date < (today.rows[0]?.today ?? project.due_date)) {
      return { code: "GATE_DUE_DATE_PASSED", message: "项目截止日期已过，请先调整截止日期再开始" };
    }
    return null;
  }
  if (to === "COMPLETED") {
    const consumed = await client.query(
      `SELECT 1 FROM consumptions WHERE project_id = $1 AND status = 'ACTIVE' LIMIT 1`,
      [project.id]
    );
    if (!consumed.rowCount) {
      return { code: "GATE_NO_CONSUMPTION", message: "项目还没有任何材料消耗记录，不能标记为完成（可勾选跳过阶段门强制完成）" };
    }
  }
  return null;
}

export async function insertStatusHistory(
  client: Queryable,
  params: {
    projectId: string;
    fromStatus: ProjectStatus | null;
    toStatus: ProjectStatus;
    kind: ProjectTransitionKind;
    reason?: string | null;
    gateSkipped?: boolean;
    actorUserId: string | null;
    requestId?: string;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO project_status_history(project_id, from_status, to_status, transition_kind, reason, gate_skipped,
       actor_user_id, request_id)
     VALUES ($1, $2::project_status, $3::project_status, $4, $5, $6, $7, $8)`,
    [
      params.projectId,
      params.fromStatus,
      params.toStatus,
      params.kind,
      params.reason ?? null,
      params.gateSkipped ?? false,
      params.actorUserId,
      params.requestId ?? null
    ]
  );
}

/** 项目详情中的状态流转历史（含操作人） */
export async function listStatusHistory(client: Queryable, projectId: string) {
  const result = await client.query(
    `SELECT h.id, h.from_status AS "fromStatus", h.to_status AS "toStatus",
            h.transition_kind AS "transitionKind", h.reason, h.gate_skipped AS "gateSkipped",
            h.created_at AS "createdAt", u.display_name AS "actorName"
       FROM project_status_history h LEFT JOIN users u ON u.id = h.actor_user_id
      WHERE h.project_id = $1 ORDER BY h.created_at DESC, h.id DESC`,
    [projectId]
  );
  return result.rows;
}
