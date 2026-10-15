import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "./i18n";
import { Button, s } from "./ui";

interface PdfReaderProps {
  url: string;
  token: string;
  pageCount: number;
}
export default function PdfReader({ url, pageCount }: PdfReaderProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  return (
    <View style={{ gap: 12 }}>
      <View style={[s.between, { gap: 8, flexWrap: "wrap" }]}>
        <View style={[s.row, { gap: 8 }]}>
          <Button small icon={ChevronLeft} disabled={page <= 1} onPress={() => setPage(page - 1)}>
            {t("tools.pdfPrevious")}
          </Button>
          <Text style={s.small}>
            {page} / {pageCount}
          </Text>
          <Button
            small
            icon={ChevronRight}
            disabled={page >= pageCount}
            onPress={() => setPage(page + 1)}
          >
            {t("tools.pdfNext")}
          </Button>
        </View>
        <View style={[s.row, { gap: 8 }]}>
          <Button small icon={Minus} disabled={zoom <= 50} onPress={() => setZoom(zoom - 25)}>
            {t("tools.pdfZoomOut")}
          </Button>
          <Text style={s.small}>{zoom}%</Text>
          <Button small icon={Plus} disabled={zoom >= 200} onPress={() => setZoom(zoom + 25)}>
            {t("tools.pdfZoomIn")}
          </Button>
        </View>
      </View>
      <iframe
        key={`${page}:${zoom}`}
        title={t("tools.pdfReaderTitle")}
        src={`${url}#page=${page}&zoom=${zoom}`}
        style={{ height: 570, width: "100%", border: 0, borderRadius: 12, background: "#e7e9e3" }}
      />
      <Text style={s.small}>{t("tools.pdfReaderHint")}</Text>
    </View>
  );
}
