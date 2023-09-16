import { SendCodeEmail } from "../emails/send-code";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const PreviewEmail = () => {
  return (
    <div style={{ position: "fixed", inset: 0, width: "100%", height: "100%" }}>
      <SendCodeEmail />
    </div>
  );
};

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <PreviewEmail />
  </StrictMode>
);
