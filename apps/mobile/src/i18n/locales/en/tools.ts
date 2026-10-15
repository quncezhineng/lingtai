import type { Dictionary } from "../../types";

/** 工具调用卡片文案（命名空间：tools）。 */
const tools = {
  // Jev 工具卡片
  "tools.sourceLink": "Source: {title}",
  "tools.chooseExhibit": "Choose this exhibit",
  "tools.chooseOption": "Choose this option",
  "tools.chooseOptionA11y": "{caption}: {label} (option {position})",
  "tools.preparingChoices": "Preparing choices…",
  "tools.choicesUnavailable": "The choices could not be displayed. Please retry.",
  "tools.sampleMode": "Sample · scripted decisions",
  "tools.liveMode": "Live Jev · model decisions",
  "tools.previousPreference": "Previous preference: {label}",
  "tools.earlierChoices": "Earlier choices",
  "tools.choiceSubmitted": "Choice submitted",
  "tools.retryChoice": "Retry choice",
  // 浏览器工具卡片
  "tools.openingAPage": "Opening a page",
  "tools.browserPageFailed": "The browser did not return a page. Try your request again.",
  "tools.readingPage": "Reading the page…",
  "tools.browsingPaused": "Browsing paused",
  "tools.couldntReadPage": "Couldn’t read the page",
  "tools.pageRead": "Page read",
  "tools.browserPreview": "Browser preview: {title}",
  "tools.pageVisitedMovedOn": "Page visited. The browser has moved on.",
  "tools.sessionSavedReopen": "Session saved. Take control to reopen it.",
  "tools.sessionNeedsAttention": "Session needs attention. Take control to reconnect.",
  "tools.previewUnavailable": "Preview unavailable. You can still take control.",
  "tools.connectingSavedSession": "Connecting to the saved session…",
  "tools.takeControl": "Take control",
  "tools.reconnectPreview": "Reconnect preview",
  // 桌面工具卡片
  "tools.desktopTitle": "Desktop",
  "tools.usingDesktop": "Using the desktop…",
  "tools.desktopStepFailed": "The desktop step failed",
  "tools.desktopStep": "Desktop step",
  "tools.computerOffline":
    "The computer is offline. Start it to see the desktop; apps that were open are closed.",
  "tools.starting": "Starting…",
  "tools.startComputer": "Start computer",
  "tools.latestDesktopScreenshot": "Latest desktop screenshot",
  "tools.openInDesktopTab": "Open in Desktop tab",
  // 邮件工具卡片
  "tools.mailReadingPaused": "Mail reading paused",
  "tools.checkingInbox": "Checking your inbox…",
  "tools.readingEmail": "Reading the email…",
  "tools.mailboxNoResults": "The mailbox did not return readable results.",
  "tools.mailSearchNone": "No matching emails",
  "tools.mailSearchFound": "Found {count} emails",
  "tools.mailSearchFoundOne": "Found 1 email",
  "tools.mailSearchFoundAtLeast": "Found at least {count} emails",
  "tools.mailSearchFoundAtLeastOne": "Found at least 1 email",
  "tools.emailUndisplayable": "The email could not be displayed.",
  "tools.noMessagesInThread": "No messages in this thread.",
  "tools.mailEmailOneMessage": "Email · 1 message",
  "tools.mailEmailMessages": "Email · {count} messages",
  "tools.showingExcerpt": "Showing an excerpt of this thread.",
  "tools.openEmail": "Open email",
  // 搜索工具卡片
  "tools.searchNoResults": "Search did not return readable results.",
  "tools.searchFailed": "Search failed",
  "tools.searchingWeb": "Searching the web…",
  "tools.searchStopped": "Search stopped",
  "tools.searchFoundSources": "Found {count} sources",
  "tools.searchFoundOneSource": "Found 1 source",
  "tools.noSourcesFound": "No sources found",
  "tools.couldNotOpenSource": "Could not open this source.",
  "tools.resultsOmitted": "Some search results or excerpts were omitted.",
  // 桌面实时流
  "tools.computerDesktop": "Computer desktop",
  "tools.opening": "Opening…",
  "tools.openDesktop": "Open desktop",
  // 助手回复
  "tools.imageAlt": "[Image: {alt}]",
  "tools.imagePlaceholder": "[Image]",
  // 后台更新
  "tools.updateForYou": "An update for you",
  "tools.dismissBackgroundUpdate": "Dismiss background update",
  "tools.moreUpdates": "{count} more updates",
  "tools.moreUpdatesOne": "1 more update",
  "tools.viewTask": "View task",
  // 日期 / 时间编辑器
  "tools.chooseValidTimeZone": "Choose a valid time zone.",
  "tools.dateFieldDate": "{label} date",
  "tools.dateFieldTime": "{label} time",
  "tools.dateFieldDatePlaceholder": "YYYY-MM-DD",
  "tools.dateFieldTimePlaceholder": "HH:MM (24-hour)",
  // 浏览器控制台
  "tools.browserConsoleTitle": "Remote browser session console",
  // PDF 阅读器
  "tools.pdfPrevious": "Previous",
  "tools.pdfNext": "Next",
  "tools.pdfZoomOut": "Zoom out",
  "tools.pdfZoomIn": "Zoom in",
  "tools.pdfReaderTitle": "PDF document reader",
  "tools.pdfReaderHint": "Use the reader toolbar to download or print a copy.",
  // 对话内文件产物
  "tools.openPdf": "Open PDF: {name}",
  "tools.fileTapSingle": "1 page · Tap to read the document",
  "tools.fileTapPlural": "{pageCount} pages · Tap to read the document",
  "tools.reloadTaskResults": "Reload task results",
  // 浏览器地址校验
  "tools.enterWebsiteAddress":
    "Enter a website address, like copilotkit.ai or https://news.ycombinator.com.",
} satisfies Dictionary;

export default tools;
