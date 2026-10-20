import assert from "node:assert/strict";
import { test } from "node:test";
import { displayUserMessage, findReferencedFile } from "../src/chat-content.ts";

test("attachment metadata is hidden from the user bubble and returned as chips", () => {
  const content =
    "Compare these filings\n\nAttached documents: Alpha, Inc. report.pdf (artifact ID: file-1), data.csv (artifact ID: file-2)";
  assert.deepEqual(displayUserMessage(content), {
    text: "Compare these filings",
    attachments: [
      { name: "Alpha, Inc. report.pdf", id: "file-1" },
      { name: "data.csv", id: "file-2" },
    ],
  });
});

test("ordinary user text is returned unchanged", () => {
  assert.deepEqual(displayUserMessage("What changed this quarter?"), {
    text: "What changed this quarter?",
    attachments: [],
  });
});

test("a malformed attachment tail never leaks transport metadata into the bubble", () => {
  assert.deepEqual(displayUserMessage("Read this\n\nAttached documents: not-an-artifact"), {
    text: "Read this",
    attachments: [],
  });
});

test("inline code and relative links resolve to thread files", () => {
  const files = [
    { id: "file-1", name: "catl_report.html" },
    { id: "file-2", name: "notes.md" },
  ];
  assert.equal(findReferencedFile("catl_report.html", files)?.id, "file-1");
  assert.equal(findReferencedFile("./catl_report.html", files)?.id, "file-1");
  assert.equal(findReferencedFile("reports/catl_report.html", files)?.id, "file-1");
  assert.equal(findReferencedFile("notes.md?download=1", files)?.id, "file-2");
  assert.equal(findReferencedFile("file-2", files)?.id, "file-2");
  assert.equal(findReferencedFile("catl%20report.html", files), undefined);
  assert.equal(findReferencedFile("https://example.com/report.pdf", files), undefined);
});
