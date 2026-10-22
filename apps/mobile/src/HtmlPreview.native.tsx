import { useState } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";
import { ErrorNotice } from "./ui";

/**
 * 研究产物 HTML 网页的原生渲染：用 WebView 的 `source={{ html }}` 展示
 * 构建好的 HTML 字符串，与 Web 端 iframe 保持一致的内联样式效果。
 * 外层 View 用 `flex: 1` 撑满「全屏详情弹窗」的剩余空间，WebView 填满自身容器。
 */
export default function HtmlPreview({ html }: { html: string; title?: string }) {
  const [error, setError] = useState("");
  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <ErrorNotice error={error} />
      <WebView
        originWhitelist={["about:srcdoc"]}
        source={{ html }}
        onError={(event) => setError(event.nativeEvent.description)}
        style={{ flex: 1, borderRadius: 12, backgroundColor: "#FFF" }}
      />
    </View>
  );
}
