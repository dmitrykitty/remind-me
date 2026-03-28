import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { FishjamProvider } from "@fishjam-cloud/react-client";
import App from "./App";
import VolunteerPanel from "./components/VolunteerPanel";
import "./index.css";

const FISHJAM_ID = import.meta.env.VITE_FISHJAM_ID as string;

function Router() {
  const [path, setPath] = useState(window.location.hash);

  useEffect(() => {
    const onHash = () => setPath(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (path === "#/volunteer") {
    return <VolunteerPanel />;
  }
  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FishjamProvider fishjamId={FISHJAM_ID}>
      <Router />
    </FishjamProvider>
  </StrictMode>,
);
