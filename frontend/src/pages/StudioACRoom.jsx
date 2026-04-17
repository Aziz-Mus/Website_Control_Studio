import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// StudioACRoom is no longer used — AC controls are merged into StudioAC.
// This component redirects to /studio/ac to avoid broken routes.
export default function StudioACRoom() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/studio/ac", { replace: true }); }, [navigate]);
  return null;
}
