import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// SVG country flags (bundled as CSS classes). Used instead of emoji flags
// because Windows/Chrome doesn't render flag emoji glyphs — it shows the
// 2-letter code or nothing at all. These are actual images, so they render
// the same on every OS/browser.
import "flag-icons/css/flag-icons.min.css";
import { ErrorBoundary } from "./components/ErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
