import { MessageCircleQuestion } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import type { AgentTask } from "../../../packages/domain/src/agent";
import { useAgentWorkspace } from "./agent-workspace";
import { localizeAgentName, runtimeLabel, useTranslation } from "./i18n";
import { Button, colors, ErrorNotice } from "./ui";
import { useWorkspace } from "./workspace";

function answerFields(task: AgentTask): boolean {
  return Array.isArray(task.state.missingFields) && task.state.missingFields.length > 0;
}

function stringState(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Whether this task has a current question or a persisted answered question to show in chat. */
export function taskHasQuestion(task: AgentTask): boolean {
  if (task.status === "waiting_input" && task.question?.trim()) return true;
  return !!stringState(task.state.answeredQuestion) && !!stringState(task.state.answer);
}

export function QuestionCard({ task, agentName }: { task: AgentTask; agentName?: string }) {
  const { t } = useTranslation();
  const { mutate } = useAgentWorkspace();
  const { open } = useWorkspace();
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState<{ question: string; answer: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pending = task.status === "waiting_input" && !!task.question?.trim();
  const storedQuestion = stringState(task.state.answeredQuestion);
  const storedAnswer = stringState(task.state.answer);
  const question = pending
    ? runtimeLabel(task.question)
    : runtimeLabel(storedQuestion) || submitted?.question || "";
  const answeredText = pending ? "" : storedAnswer || submitted?.answer || "";
  if (!question) return null;

  const needsFields = pending && answerFields(task);
  const name = localizeAgentName(agentName);

  async function submit() {
    const text = answer.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    try {
      await mutate(`/tasks/${task.id}/input`, { answer: text });
      setSubmitted({ question, answer: text });
      setAnswer("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.header}>
          <MessageCircleQuestion size={14} color={colors.blueDark} />
          <Text style={styles.headerText}>{t("tools.questionAsks", { name })}</Text>
        </View>
        <Text selectable style={styles.question}>
          {question}
        </Text>
        {pending && !submitted && !needsFields && (
          <Text style={styles.hint}>{t("tools.questionReplyBelow")}</Text>
        )}
        {pending && needsFields && (
          <>
            <Text style={styles.hint}>{t("tools.questionMissingFields")}</Text>
            <Button small onPress={() => open({ type: "task", taskId: task.id })}>
              {t("tools.questionOpenTask")}
            </Button>
          </>
        )}
        {pending && !needsFields && !submitted && (
          <View style={styles.answerBox}>
            <TextInput
              accessibilityLabel={t("tools.questionYourAnswer")}
              editable={!busy}
              multiline
              onChangeText={setAnswer}
              placeholder={t("tools.questionPlaceholder")}
              placeholderTextColor={colors.muted}
              style={styles.input}
              textAlignVertical="top"
              value={answer}
            />
            <Button
              primary
              busy={busy}
              disabled={!answer.trim()}
              onPress={() => void submit()}
              style={styles.submit}
            >
              {t("tools.questionSubmit")}
            </Button>
          </View>
        )}
        {!!answeredText && (
          <View style={styles.answer}>
            <Text style={styles.answerLabel}>{t("tools.questionYou")}</Text>
            <Text selectable style={styles.answerText}>
              {answeredText}
            </Text>
          </View>
        )}
        <ErrorNotice error={error} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "flex-start", width: "100%", maxWidth: 600 },
  card: {
    width: "100%",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 20,
    borderBottomLeftRadius: 7,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    backgroundColor: colors.card,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerText: { color: colors.blueDark, fontSize: 12.5, lineHeight: 18, fontWeight: "600" },
  question: { color: colors.text, fontSize: 15, lineHeight: 21 },
  hint: { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  answerBox: { gap: 8, marginTop: 6 },
  input: {
    minHeight: 52,
    maxHeight: 160,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#F8F8FA",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  submit: { alignSelf: "flex-end", minHeight: 38, paddingVertical: 8, paddingHorizontal: 16 },
  answer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 5,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  answerLabel: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  answerText: { flexShrink: 1, color: colors.text, fontSize: 13, lineHeight: 19 },
});
