import type { AgentNotification } from "../../../packages/domain/src/agent.ts";
import type { Store } from "./db.ts";

/**
 * 用户在某个任务里把事情做完了（批准/拒绝复核、补充信息、取消、重试）之后，
 * 这个任务先前留下的未读通知就不该继续点亮「通知」右上角的提示：直接标为已读。
 * 只处理该任务自己的通知，其他任务和工作区级别的通知保持不变。
 */
export async function resolveTaskNotifications(db: Store, owner: string, taskId?: string) {
  if (!taskId) return;
  const notifications = await db.listByField<AgentNotification>(
    owner,
    "notifications",
    "taskId",
    taskId,
  );
  for (const notification of notifications) {
    if (notification.read) continue;
    await db.compareAndSwap<AgentNotification>(
      owner,
      "notifications",
      notification.id,
      { read: false },
      { read: true },
    );
  }
}
