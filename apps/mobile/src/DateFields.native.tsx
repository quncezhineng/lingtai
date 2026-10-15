import { View } from "react-native";
import { useTranslation } from "./i18n";
import { Field } from "./ui";
export interface DateFieldsProps {
  label: string;
  date: string;
  time: string;
  allDay: boolean;
  onChange: (date: string, time: string) => void;
}
export default function DateFields({ label, date, time, allDay, onChange }: DateFieldsProps) {
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ flex: 1.2 }}>
        <Field
          label={t("tools.dateFieldDate", { label })}
          value={date}
          onChangeText={(value) => onChange(value, time)}
          placeholder={t("tools.dateFieldDatePlaceholder")}
          keyboardType="numbers-and-punctuation"
        />
      </View>
      {!allDay && (
        <View style={{ flex: 1 }}>
          <Field
            label={t("tools.dateFieldTime", { label })}
            value={time}
            onChangeText={(value) => onChange(date, value)}
            placeholder={t("tools.dateFieldTimePlaceholder")}
            keyboardType="numbers-and-punctuation"
          />
        </View>
      )}
    </View>
  );
}
