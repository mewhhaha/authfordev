import { render } from "@react-email/components";
import { SendCodeEmail } from "../emails/send-code";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";

const html = render(<SendCodeEmail />);

mkdirSync(path.join(__dirname, "..", "dist"), { recursive: true });
writeFileSync(
  path.join(__dirname, "..", "dist", "send-code.json"),
  JSON.stringify({ html })
);
