import type { Dictionary } from "../../types";

/** 对话与侧边对话面板文案（命名空间：threads）。 */
const threads = {
  "threads.sheetSubtitleSample": "你的工作区",
  "threads.mainChatTitle": "主对话",
  "threads.mainChatDetail": "你正在进行的对话",
  "threads.mainChatSavedDetail": "保存在当前工作区",
  "threads.newSideChat": "新建侧边对话",
  "threads.sideChats": "侧边对话",
  "threads.showActive": "显示进行中",
  "threads.archived": "已归档",
  "threads.retryConversations": "重试加载对话",
  "threads.sideChatNumber": "侧边对话 {index}",
  "threads.openInThisApp": "在当前应用打开",
  "threads.openConversation": "打开对话：{name}",
  "threads.untitledConversation": "未命名对话",
  "threads.conversationName": "对话名称",
  "threads.saveName": "保存名称",
  "threads.rename": "重命名",
  "threads.restore": "恢复",
  "threads.archive": "归档",
  "threads.emptyArchived": "暂无已归档对话。",
  "threads.emptyActive": "在这里单独记录一个话题，主对话始终可用。",
  "threads.loadMore": "加载更多对话",
  "threads.sideChatFootnote": "侧边对话各自保留独立的上下文，但会共享智能体已保存的记忆。",
  "threads.workspaceSavedNote": "你的对话保存在当前工作区中，可在「应用」里管理各种连接。",
  "threads.delegateTask": "委派任务",
  "threads.delegateTaskDetail": "计划、文档或支出汇总",
  "threads.agentComputer": "智能体电脑",
  "threads.agentComputerDetail": "浏览器、会话与文档",
  "threads.calendar": "日历",
  "threads.files": "文件",
  "threads.appsAndSettings": "应用与设置",
  "threads.refreshWorkspace": "刷新工作区",
} satisfies Dictionary;

export default threads;
