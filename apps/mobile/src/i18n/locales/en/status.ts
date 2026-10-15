import type { Dictionary } from "../../types";

/**
 * 领域枚举值的展示文案（命名空间：status）。
 *
 * key 的后缀**直接使用原始枚举值**（含下划线），这样 `statusLabel()` 可以
 * 用 `status.${value}` 直接查表，新增枚举值时只需在此登记。
 * 未登记的值会退回「下划线转空格 + 首字母大写」的通用处理。
 */
const status = {
  // 任务状态（TaskStatus）
  "status.queued": "Queued",
  "status.running": "Running",
  "status.waiting_approval": "Waiting approval",
  "status.waiting_input": "Waiting input",
  "status.scheduled": "Scheduled",
  "status.paused": "Paused",
  "status.succeeded": "Succeeded",
  "status.failed": "Failed",
  "status.cancelled": "Cancelled",
  // 行动（action）状态
  "status.awaiting_review": "Awaiting review",
  "status.executing": "Executing",
  "status.expired": "Expired",
  "status.denied": "Denied",
  "status.outcome_unknown": "Outcome unknown",
  // 任务步骤状态
  "status.pending": "Pending",
  "status.waiting": "Waiting",
  // 任务 / 制品 / 事件类型
  "status.agent": "Agent",
  "status.document": "Document",
  "status.monitor": "Monitor",
  "status.finance": "Finance",
  "status.plan": "Plan",
  "status.step": "Step",
  "status.observation": "Observation",
  "status.approval": "Approval",
  "status.result": "Result",
  "status.error": "Error",
  "status.status": "Status",
  "status.comparison": "Comparison",
  "status.report": "Report",
  // 目标 / 监控状态
  "status.active": "Active",
  "status.completed": "Completed",
  "status.stopped": "Stopped",
  // 建议状态
  "status.new": "New",
  "status.dismissed": "Dismissed",
  "status.accepted": "Accepted",
  // 连接状态
  "status.connected": "Connected",
  "status.disconnected": "Disconnected",
  "status.sample": "Sample",
  "status.unconfigured": "Unconfigured",
  "status.unavailable": "Unavailable",
  // 集成类型
  "status.standalone": "Standalone",
  "status.openbot": "OpenBot",
  // 电脑 / 运行状态
  "status.timed_out": "Timed out",
  "status.interrupted": "Interrupted",
  "status.idle": "Idle",
  "status.closed": "Closed",
  // 语气与头像配色
  "status.warm": "Warm",
  "status.concise": "Concise",
  "status.thoughtful": "Thoughtful",
  "status.sky": "Sky",
  "status.sand": "Sand",
  "status.lilac": "Lilac",
} satisfies Dictionary;

export default status;
