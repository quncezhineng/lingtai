import { View } from "react-native";
import { useTranslation } from "./i18n";

/**
 * 研究产物 HTML 网页的 Web 渲染：把构建好的 HTML 字符串通过 `srcDoc`
 * 注入 iframe，不请求任何外部资源。静态样式、无脚本，天然安全。
 * 外层 View 用 `flex: 1` 撑满「全屏详情弹窗」的剩余空间，
 * iframe 再用 `height: 100%` 填满自身容器。
 */
export default function HtmlPreview({ html, title }: { html: string; title?: string }) {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <iframe
        title={title ?? t("agent.artifactPreview")}
        srcDoc={html}
        sandbox=""
        referrerPolicy="no-referrer"
        style={{ height: "100%", width: "100%", border: 0, borderRadius: 12, background: "#FFF" }}
      />
    </View>
  );
}
