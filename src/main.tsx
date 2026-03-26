import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// error tracking
import { initSentry } from "./lib/sentry";

// initialize Sentry as early as possible; it will no-op in non-prod
initSentry();

document.documentElement.lang = "ar";
document.documentElement.dir = "rtl";

createRoot(document.getElementById("root")!).render(<App />);
