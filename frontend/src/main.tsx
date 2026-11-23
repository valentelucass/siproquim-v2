import { createRoot } from "react-dom/client";
import "@fontsource-variable/figtree";
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "@astryxdesign/theme-neutral/theme.css";
import "./workspace.css";
import App from "./App";
import { InternationalizationProvider } from "@astryxdesign/core/i18n";
import ptBR from "@astryxdesign/core/locales/pt-BR.generated.js";
const mensagens = { ...ptBR, "@astryx.field.labelTooltip": "Sobre {label}" };
createRoot(document.getElementById("root")!).render(
  <InternationalizationProvider
    locale="pt-BR"
    messages={{ "pt-BR": mensagens }}
  >
    <App />
  </InternationalizationProvider>,
);
