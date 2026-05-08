import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initSentry } from "@/lib/sentry";

initSentry();

try {
  createRoot(document.getElementById("root")!).render(<App />);
} catch (error) {
  console.error("Error rendering app:", error);
}
