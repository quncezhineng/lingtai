import type { Artifact } from "../../../packages/domain/src";

export interface UserAttachment {
  id: string;
  name: string;
}

export interface DisplayUserMessage {
  text: string;
  attachments: UserAttachment[];
}

const ATTACHMENT_MARKER = /\n\nAttached documents:\s*/;
const ATTACHMENT_ENTRY = /(.+?)\s+\(artifact ID:\s*([^)]+)\)(?:\s*,\s*|$)/g;

/** The composer appends artifact ids after a blank line for the agent. Hide that
 *  transport detail from the bubble and expose the files as tappable chips. */
export function displayUserMessage(content: string): DisplayUserMessage {
  const marker = ATTACHMENT_MARKER.exec(content);
  if (!marker) return { text: content, attachments: [] };
  const text = content.slice(0, marker.index).trimEnd();
  const segment = content.slice(marker.index + marker[0].length);
  const attachments: UserAttachment[] = [];
  for (const match of segment.matchAll(ATTACHMENT_ENTRY)) {
    const name = match[1]?.trim();
    const id = match[2]?.trim();
    if (name && id) attachments.push({ id, name });
  }
  return { text, attachments };
}

function decodeReference(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Match an inline code span or relative link against the files of this thread. */
export function findReferencedFile<T extends Pick<Artifact, "id" | "name">>(
  value: string,
  files: readonly T[],
): T | undefined {
  const clean = decodeReference(value.trim())
    .replace(/^file:\/\//, "")
    .split(/[?#]/, 1)[0]
    .replace(/^\.\//, "");
  if (!clean) return undefined;
  const basename = clean.split("/").pop() ?? clean;
  return files.find((file) => file.id === clean || file.name === clean || file.name === basename);
}
