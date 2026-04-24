// GoRedirect.jsx — drop-in React component for Emergent full-stack apps.
//
// Why this exists:
//   On Emergent-hosted apps, the ingress routes only paths prefixed with /api/
//   to the FastAPI backend on port 8001. Everything else goes to the React
//   frontend on port 3000. So a raw `/go/agent-z-rig` hit lands on React, not
//   FastAPI. This component runs on mount, rebuilds the same URL against
//   `/api/go/...`, and hard-redirects there, preserving query params.
//
// Usage (in src/App.js or your router):
//     import GoRedirect from "./GoRedirect";
//     // React Router:
//     <Route path="/go/:slug" element={<GoRedirect />} />
//
// Result: /go/agent-z-rig?src=ig  ->  /api/go/agent-z-rig?src=ig  (handled
// by affiliate_router.py)  ->  302 to the Amazon link.
//
// If/when you move to Vercel (serverless) this file is unnecessary.

import { useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";

export default function GoRedirect() {
  const { slug } = useParams();
  const { search } = useLocation();

  useEffect(() => {
    const target = `/api/go/${encodeURIComponent(slug || "")}${search || ""}`;
    window.location.replace(target);
  }, [slug, search]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#05070d",
        color: "#7dd3fc",
        fontFamily: "monospace",
        fontSize: "0.9rem",
        letterSpacing: "0.2em",
        textTransform: "uppercase",
      }}
      data-testid="go-redirect"
    >
      routing…
    </div>
  );
}
