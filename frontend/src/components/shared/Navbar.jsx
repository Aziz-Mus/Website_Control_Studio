import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [onAirExit, setOnAirExit] = useState(false);
  const [switchLoading, setSwitchLoading] = useState(false);
  const [switchConnected, setSwitchConnected] = useState(false);

  const isStudio = location.pathname.startsWith("/studio");
  const isShowcase = location.pathname.startsWith("/showcase");

  // Remember last studio sub-page
  useEffect(() => {
    if (location.pathname.startsWith("/studio") && location.pathname !== "/studio") {
      localStorage.setItem("lastStudioPage", location.pathname);
    }
  }, [location.pathname]);

  const handleStudioClick = () => {
    const last = localStorage.getItem("lastStudioPage");
    if (last && last !== "/studio") {
      navigate(last);
    } else {
      navigate("/studio");
    }
  };

  const checkOnAirStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/studio/headlights/onair-exit-status`);
      setSwitchConnected(res.data.connected);
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => { checkOnAirStatus(); }, [checkOnAirStatus, location.pathname]);

  const handleOnAirToggle = async (checked) => {
    setSwitchLoading(true);
    try {
      const res = await axios.post(`${API}/studio/headlights/onair-exit-control?state=${checked ? "ON" : "OFF"}`);
      if (res.data.status === "success") {
        setOnAirExit(checked);
        toast.success(checked ? "On Air / Exit aktif" : "On Air / Exit nonaktif");
      } else {
        setOnAirExit(false);
        toast.error("Gagal: " + (res.data.error || "Tidak dapat terhubung"));
      }
    } catch (e) {
      setOnAirExit(false);
      toast.error("Gagal mengendalikan On Air / Exit");
    }
    setSwitchLoading(false);
  };

  return (
    <nav data-testid="navbar" className="h-16 flex items-center px-6 md:px-12 bg-white border-b border-[#E5E7EB] sticky top-0 z-50">
      {/* Left: Logo + STUDIO - min-w to balance with right side */}
      <div className="flex items-center gap-0 cursor-pointer select-none min-w-[150px]" onClick={() => navigate("/studio")} data-testid="nav-brand">
        <div className="flex items-center bg-[#1C2025] rounded-md px-2.5 py-1.5 gap-2.5">
          <img src="/company_logo.svg" alt="Logo" className="h-7 w-auto" />
          <div className="w-px h-5 bg-gray-500 opacity-40" />
          <span className="text-sm font-semibold tracking-wide text-white" style={{ fontFamily: 'Work Sans, sans-serif' }}>
            STUDIO
          </span>
        </div>
      </div>

      {/* Center: Nav links */}
      <div className="flex-1 flex justify-center gap-8">
        <button data-testid="nav-studio" onClick={handleStudioClick}
          className={`text-sm font-medium tracking-wide transition-colors pb-0.5 ${isStudio ? "text-[#DA2C38] border-b-2 border-[#DA2C38]" : "text-[#637083] hover:text-[#1C2025]"}`}
          style={{ fontFamily: 'Work Sans, sans-serif' }}>
          Studio
        </button>
        <button data-testid="nav-showcase" onClick={() => navigate("/showcase")}
          className={`text-sm font-medium tracking-wide transition-colors pb-0.5 ${isShowcase ? "text-[#DA2C38] border-b-2 border-[#DA2C38]" : "text-[#637083] hover:text-[#1C2025]"}`}
          style={{ fontFamily: 'Work Sans, sans-serif' }}>
          Showcase Room
        </button>
      </div>

      {/* Right: On Air/Exit Switch - always visible */}
      <div className="flex items-center gap-2 min-w-[150px] justify-end" data-testid="onair-exit-area">
        <span className="text-xs font-medium text-[#637083] tracking-wide whitespace-nowrap">On Air/Exit</span>
        <Switch
          data-testid="onair-exit-switch"
          checked={onAirExit}
          onCheckedChange={handleOnAirToggle}
          disabled={switchLoading}
          className="data-[state=checked]:bg-[#DA2C38]"
        />
      </div>
    </nav>
  );
}
