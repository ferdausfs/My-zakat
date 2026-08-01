import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Self-hosted icons & fonts (no CDN — required for the app to work offline).
// Fonts come via src/fonts.css (curated woff2 subsets) imported by index.css.
import "@fortawesome/fontawesome-free/css/fontawesome.min.css";
import "@fortawesome/fontawesome-free/css/solid.min.css";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
