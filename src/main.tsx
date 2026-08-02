import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Self-hosted icons & fonts (no CDN — required for the app to work offline).
// Fonts come via src/fonts.css (curated woff2 subsets) imported by index.css.
import "@fortawesome/fontawesome-free/css/fontawesome.min.css";
import "@fortawesome/fontawesome-free/css/solid.min.css";
import "./index.css";
import App from "./App";
import { loadGoogleIdentity } from "./utils/googleDrive";

// Warm up the Google Identity Services script at startup (fire-and-forget) so
// the FIRST "Google দিয়ে সাইন ইন" click doesn't have to download the script —
// that network round-trip inside the click handler is what makes the consent
// popup get blocked as "not user-activated". Fail silently; sign-in still
// works (it loads the script on demand), just possibly with a re-click.
loadGoogleIdentity().catch(() => {});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
