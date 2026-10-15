import type { Dictionary } from "../../types";

/**
 * 领域枚举值的展示文案（命名空间：status）。
 * key 后缀与原始枚举值一一对应，详见 locales/en/status.ts。
 */
const status = {
  // 任务状态（TaskStatus）
  "status.queued": "排队中",
  "status.running": "进行中",
  "status.waiting_approval": "等待审批",
  "status.waiting_input": "等待输入",
  "status.scheduled": "已安排",
  "status.paused": "已暂停",
  "status.succeeded": "已完成",
  "status.failed": "失败",
  "status.cancelled": "已取消",
  // 行动（action）状态
  "status.awaiting_review": "等待复核",
  "status.executing": "执行中",
  "status.expired": "已过期",
  "status.denied": "已拒绝",
  "status.outcome_unknown": "结果未知",
  // 任务步骤状态
  "status.pending": "待处理",
  "status.waiting": "等待中",
  // 任务 / 制品 / 事件类型
  "status.agent": "任务",
  "status.document": "文档",
  "status.monitor": "监控",
  "status.finance": "财务",
  "status.plan": "计划",
  "status.step": "步骤",
  "status.observation": "观察",
  "status.approval": "审批",
  "status.result": "结果",
  "status.error": "错误",
  "status.status": "状态",
  "status.comparison": "对比",
  "status.report": "报告",
  // 目标 / 监控状态
  "status.active": "进行中",
  "status.completed": "已完成",
  "status.stopped": "已停止",
  // 建议状态
  "status.new": "新",
  "status.dismissed": "已忽略",
  "status.accepted": "已接受",
  // 连接状态
  "status.connected": "已连接",
  "status.disconnected": "未连接",
  "status.sample": "示例",
  "status.unconfigured": "未配置",
  "status.unavailable": "不可用",
  // 集成类型
  "status.standalone": "独立运行",
  "status.openbot": "OpenBot",
  // 电脑 / 运行状态
  "status.timed_out": "已超时",
  "status.interrupted": "已中断",
  "status.idle": "空闲",
  "status.closed": "已关闭",
  // 语气与头像配色
  "status.warm": "温和",
  "status.concise": "简洁",
  "status.thoughtful": "周到",
  "status.sky": "天空蓝",
  "status.sand": "沙色",
  "status.lilac": "淡紫",
} satisfies Dictionary;

export default status;
