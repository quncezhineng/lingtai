import type { Dictionary } from "../../types";

/** 详情面板文案（命名空间：details）。 */
const details = {
  // Workspace sheet.
  "details.workspaceSubtitle": "Your personal inverstment research agent.",
  "details.connections": "Connections",

  // Mail thread.
  "details.messageInConversation": "{count} message in this conversation",
  "details.messagesInConversation": "{count} messages in this conversation",
  "details.loadingConversation": "Loading the conversation…",
  "details.toLine": "To: {recipients}",
  "details.pdfAttachment": "{pages} pages · PDF attachment",
  "details.openAttachment": "Open attachment",
  "details.reloadConversation": "Reload conversation",
  "details.writeReply": "Write a reply",

  // Email editor.
  "details.draftSaved": "Draft saved in LingTai.",
  "details.newMessage": "A new message",
  "details.emailFrom": "From {email} · saved privately in LingTai",
  "details.to": "To",
  "details.toPlaceholder": "person@example.com",
  "details.cc": "Cc",
  "details.optional": "Optional",
  "details.bcc": "Bcc",
  "details.subject": "Subject",
  "details.subjectPlaceholder": "What’s on your mind?",
  "details.message": "Message",
  "details.messagePlaceholder": "Start your message…",
  "details.attachments": "Attachments",
  "details.fileSizeLabel": "{name} · {size} KB",
  "details.reviewEmail": "Review email",
  "details.saveDraft": "Save draft",
  "details.reviewNote":
    "You’ll review the exact recipients, message, and attachments before anything is sent.",

  // Event editor.
  "details.editEventTitle": "Make a little time",
  "details.newEventTitle": "Something to look forward to",
  "details.editEventSubtitle": "Edit this event, then review your changes.",
  "details.newEventSubtitle": "Create an event in your calendar.",
  "details.eventTitle": "Event title",
  "details.eventTitlePlaceholder": "What are you making time for?",
  "details.allDayEvent": "All-day event",
  "details.starts": "Starts",
  "details.ends": "Ends",
  "details.allDayNote": "The end date is the day after the last day of your event.",
  "details.timeZone": "Time zone",
  "details.timeZonePlaceholder": "America/Los_Angeles",
  "details.locationLabel": "Location or meeting link",
  "details.attendees": "Attendees",
  "details.attendeesPlaceholder": "Email addresses, separated by commas",
  "details.notes": "Notes",
  "details.notesPlaceholder": "Anything else to keep in mind?",
  "details.timeOverlap": "This time overlaps",
  "details.reviewChanges": "Review changes",
  "details.reviewEvent": "Review event",
  "details.reviewDeletion": "Review deletion",

  // Action review.
  "details.oneLastLook": "One last look",
  "details.sampleActionNote": "This action stays in your local workspace.",
  "details.reviewActionNote": "Review this exact action before it changes your connected account.",
  "details.account": "Account",
  "details.none": "None",
  "details.attachmentVersion": "{name} · version {version}",
  "details.noAttachments": "No attachments",
  "details.eventLabel": "Event",
  "details.endExclusive": "{date} (exclusive)",
  "details.allDay": "All day",
  "details.yes": "Yes",
  "details.no": "No",
  "details.location": "Location",
  "details.justYou": "Just you",
  "details.deleteEventNote": "This removes the event and may notify its attendees.",
  "details.updateEventNote":
    "Attendees may receive an invitation or update from your connected calendar.",
  "details.reviewExpires":
    "Review expires {date}. Your approval applies only to the details shown above.",
  "details.approveLocally": "Approve locally",
  "details.approveAndSend": "Approve & send",
  "details.approveChange": "Approve change",
  "details.editDetails": "Edit details",
  "details.dontProceed": "Don’t proceed",
  "details.done": "Done",

  // File detail.
  "details.fileSubtitle": "{pages} pages · {size} KB · {source}",
  "details.openDownload": "Open / download",
  "details.saveOrShare": "Save or share",
  "details.attachToEmail": "Attach to email",
  "details.fillForm": "Fill this form",
  "details.fillFormNote":
    "Add your details below. Saving creates a new copy and keeps the original intact.",
  "details.unsupportedField": "{name} · this field type is not supported",
  "details.saveFilledCopy": "Save filled copy",
  "details.addedFile": "Added {date}",
  "details.addedFilledCopy": "Added {date} · filled copy",

  // Browser detail.
  "details.pdfDownloadAdded": "{count} PDF download added to Files.",
  "details.pdfDownloadsAdded": "{count} PDF downloads added to Files.",
  "details.noNewPdfDownloads": "No new PDF downloads in this session.",
  "details.browserSubtitle": "{status} · updated {time}",
  "details.websiteAddress": "Website address",
  "details.reopen": "Reopen",
  "details.reconnect": "Reconnect",
  "details.go": "Go",
  "details.retryConnection": "Retry connection",
  "details.connectingBrowser": "Connecting to your browser…",
  "details.sessionClosed": "This session is closed",
  "details.previewUnavailable": "Preview is not available",
  "details.sessionClosedDetail":
    "Your profile and downloads are saved. Reopen to continue where you left off.",
  "details.previewUnavailableDetail": "Reconnect to continue with your saved browser profile.",
  "details.openBrowserWindow": "Open browser in a window",
  "details.refreshConnection": "Refresh connection",
  "details.importPdfDownloads": "Import PDF downloads",
  "details.closeSession": "Close session",
} satisfies Dictionary;

export default details;
