import type { Dictionary } from "../../types";

/** 邮件 / 日历 / 浏览器 / 文件等工具界面文案（命名空间：screens）。 */
const screens = {
  // Today 首页
  "screens.todayEyebrow": "A little clarity, every research session",
  "screens.todayHeroTitle": "Your research, with a little\nmore room to decide.",
  "screens.todayEventsCount": "{count} things on your calendar",
  "screens.todayCalendarRoom": "Your calendar has room",
  "screens.todayUnreadEmails": ", {count} unread emails",
  "screens.todayLetMakeSpace": "Let’s make space for what matters.",
  "screens.todayPlanDay": "Plan my research",
  "screens.todayPlanDayPrompt": "Help me plan today's research",
  "screens.todayLighterDay": "A lighter research day",
  "screens.todayEverythingTogether": "Quotes, reports and decisions, together",
  "screens.todayStatUnreadLabel": "UNREAD EMAILS",
  "screens.todayStatUnreadNote": "A fresh look at your inbox",
  "screens.todayStatCalendarLabel": "ON THE CALENDAR",
  "screens.todayStatCalendarNote": "Make room for your priorities",
  "screens.todayStatPendingLabel": "WAITING FOR YOU",
  "screens.todayStatPendingNote": "Your review keeps things moving",
  "screens.todayCalendarHeading": "On your calendar",
  "screens.todayCalendarAction": "Full calendar",
  "screens.todayCalendarEmptyTitle": "Some breathing room",
  "screens.todayCalendarEmptyDetail": "No events scheduled today.",
  "screens.todayMakeTime": "Make time for something",
  "screens.todayInboxHeading": "From your inbox",
  "screens.todayInboxAction": "Open mail",
  "screens.todayInboxEmptyTitle": "Inbox is quiet",
  "screens.todayInboxEmptyDetail": "Connect Google to bring your messages here.",
  "screens.todayHelpHeading": "A hand with the little research tasks",
  "screens.todayHelpSubtitle": "Start with a thought. We’ll take it from there.",
  "screens.todayPromptAttention": "What targets need my attention today?",
  "screens.todayPromptInbox": "Catch me up on the targets I follow",
  "screens.todayPromptDocuments": "Show my recent research notes",
  "screens.todayReviewHeading": "Ready for your review",
  "screens.todayActivityHeading": "Recent activity",
  "screens.todayViewAll": "View all",
  "screens.todayReviewDetail": "Prepared · waiting for your approval",
  "screens.todayWorkspaceReady":
    "Your workspace is ready. Things you do here will appear in your activity.",

  // Agenda 日程条目
  "screens.agendaAllDay": "All day",
  "screens.agendaAttendees": "{count} attendees",
  "screens.agendaTimeForYou": "Time for you",

  // Mail 邮件
  "screens.mailSearchLabel": "Search mail",
  "screens.mailSearchPlaceholder": "Search your inbox",
  "screens.mailCompose": "Compose",
  "screens.mailTabAll": "All messages",
  "screens.mailTabUnread": "Unread · {count}",
  "screens.mailTabDrafts": "Drafts · {count}",
  "screens.mailDraftTo": "To: {to} · saved {date}",
  "screens.mailDraftsEmptyTitle": "A fresh page",
  "screens.mailDraftsEmptyDetail": "Messages you save as drafts will be here when you’re ready.",
  "screens.mailAttachmentOne": "attachment",
  "screens.mailAttachmentMany": "attachments",
  "screens.mailNoMatchTitle": "No matching messages",
  "screens.mailEmptyTitle": "Nothing in your inbox",
  "screens.mailNoMatchDetail": "Try a different name or subject.",
  "screens.mailEmptyDetail": "Connect Google in Connections to read your mail here.",

  // Calendar 日历
  "screens.calendarPrevWeek": "Previous week",
  "screens.calendarNextWeek": "Next week",
  "screens.calendarNewEvent": "New event",
  "screens.calendarYourCalendars": "Your calendars",
  "screens.calendarReadOnly": " · read only",
  "screens.calendarNext30Days": "The next 30 days",
  "screens.calendarSelectedDay": "Selected day",
  "screens.calendarNextDaysAction": "Next 30 days",
  "screens.calendarYourCalendar": "Your calendar",
  "screens.calendarZoneNote": ". Events show their own time zone.",
  "screens.calendarChecking": "Checking your calendar…",
  "screens.calendarEmptyTitle": "A little open space",
  "screens.calendarEmptyDetail30": "There’s nothing scheduled for the next 30 days.",
  "screens.calendarEmptyDetailDay": "There’s nothing on the calendar for this day.",
  "screens.calendarAddEvent": "Add an event",

  // Browser 浏览器
  "screens.browserHeading": "A place for your open tabs",
  "screens.browserSubtitle": "Browse in a private, persistent workspace session.",
  "screens.browserAddressLabel": "Website address",
  "screens.browserOpenSession": "Open session",
  "screens.browserSessionsHeading": "Browser sessions",
  "screens.browserSessionFallback": "Browser session",
  "screens.browserEmptyTitle": "Start with a website",
  "screens.browserEmptyDetail":
    "Open a session above to keep your browsing together. Live previews appear when the browser worker is configured.",

  // Files 文件
  "screens.filesSubtitle": "Reports and filings, with room to organize.",
  "screens.filesImport": "Import PDF",
  "screens.filesDocumentBadge": "DOCUMENT",
  "screens.filesPage": "page",
  "screens.filesPages": "pages",
  "screens.filesEmptyTitle": "Your documents live here",
  "screens.filesEmptyDetail":
    "Import a PDF or open a mail attachment to read, fill supported form fields, and share a copy.",

  // Activity 动态
  "screens.activityFilterAll": "All activity",
  "screens.activityFilterReview": "Needs review · {count}",
  "screens.activityActionsHeading": "Your actions",
  "screens.activityTimelineHeading": "Workspace timeline",
  "screens.activityEmptyTitle": "The beginning of your research",
  "screens.activityEmptyDetail": "Your research actions and their results will be recorded here.",
  "screens.activityCaughtUpTitle": "You’re all caught up",
  "screens.activityCaughtUpDetail":
    "When an email or calendar change needs your approval, it will appear here.",

  // Connections 连接
  "screens.connectionsNotifyFinish":
    "Finish connecting in your browser, then refresh your workspace.",
  "screens.connectionsNotifyLocalReady": "Local Google data is ready.",
  "screens.connectionsNotifyDisconnected": "Google disconnected.",
  "screens.connectionsYourConnections": "Your connections",
  "screens.connectionsConnected": "Connected",
  "screens.connectionsAvailable": "Available integrations",
  "screens.connectionsManage": "Manage {name}",
  "screens.connectionsLocalData": "Local data",
  "screens.connectionsConnect": "Connect",
  "screens.connectionsSetup": "Setup",
  "screens.connectionsNoMatch": "No matching connectors.",
  "screens.connectionsGoogleTitle": "Google connections",
  "screens.connectionsOpenBotSubtitle": "A computer for your agent",
  "screens.connectionsGoogleDescription":
    "Bring Gmail and Google Calendar into your conversations. Choose read access, then enable sending and editing when you need it.",
  "screens.connectionsConnectGoogle": "Connect Google",
  "screens.connectionsEnableSending": "Enable sending & editing",
  "screens.connectionsDisconnectGoogle": "Disconnect Google",
  "screens.connectionsEnvironmentLabel": "Environment",
  "screens.connectionsEnvSample": "Local · example data",
  "screens.connectionsEnvLive": "Live workspace",
  "screens.connectionsAssistantLabel": "Assistant",
  "screens.connectionsAssistantGuided": "Guided workflows",
  "screens.connectionsAssistantConnected": "Model connected",
  "screens.connectionsAssistantNotConfigured": "Model not configured",
  "screens.connectionsRichThreads": "Rich Threads",
  "screens.connectionsNotConnected": "Not connected",
  "screens.connectionsModelLabel": "Model",
  "screens.connectionsModelSubtitle": "Chat and background tasks run on this model.",
  "screens.connectionsModelCurrent": "Current model",
  "screens.connectionsModelEmpty":
    "This deployment runs guided sample workflows, so there is no model to switch. Set a provider key on the server to choose one here.",
  "screens.connectionsModelSwitched": "Now using {model}",
  "screens.connectionsRefresh": "Refresh connections",
  "screens.connectionsOpenBotNotice":
    "The OpenBot adapter is available in this open-source project. A live OpenBot backend has not been configured.",
  "screens.connectionsOpenBotDetail":
    "Your current computer uses LingTai’s persistent Chromium worker. OpenBot integration will expand the execution backend while keeping this interface.",

  // 权限能力标签
  "screens.capabilityReadGmail": "Read Gmail",
  "screens.capabilitySendGmail": "Send Gmail",
  "screens.capabilityReadCalendarEvents": "Read calendar events",
  "screens.capabilityReadCalendarList": "Read calendar list",
  "screens.capabilityManageCalendarEvents": "Manage calendar events",
  "screens.capabilityReadCalendars": "Read calendars",
} satisfies Dictionary;

export default screens;
