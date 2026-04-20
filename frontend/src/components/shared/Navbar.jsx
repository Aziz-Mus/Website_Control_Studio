import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const isStudio = location.pathname.startsWith("/studio");
  const isShowcase = location.pathname.startsWith("/showcase");

  // Close mobile menu on every route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Remember last studio sub-page
  useEffect(() => {
    if (location.pathname.startsWith("/studio") && location.pathname !== "/studio") {
      localStorage.setItem("lastStudioPage", location.pathname);
    }
  }, [location.pathname]);

  const handleStudioClick = () => {
    const last = localStorage.getItem("lastStudioPage");
    navigate(last && last !== "/studio" ? last : "/studio");
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
    <div ref={menuRef} className="sticky top-0 z-50">
      {/* ── Main Navbar Bar ── */}
      <nav
        data-testid="navbar"
        className="h-16 md:h-20 flex items-center px-4 md:px-12 bg-white border-b border-[#E5E7EB]"
      >
        {/* Left: Logo + STUDIO */}
        <div
          className="flex items-center flex-shrink-0 cursor-pointer select-none"
          onClick={() => navigate("/studio")}
          data-testid="nav-brand"
        >
          <div className="flex items-center gap-2 px-1 md:px-2.5 py-1.5">
            <img src="/Logo_Tab_NOBG.png" alt="Logo" className="h-8 md:h-10 w-auto" />
            <div className="w-px h-5 bg-gray-500 opacity-40" />
            <span
              className="text-sm md:text-base font-semibold tracking-wide text-black"
              style={{ fontFamily: "Work Sans, sans-serif" }}
            >
              STUDIO
            </span>
          </div>
        </div>

        {/* Center: Nav links — desktop only */}
        <div className="hidden md:flex flex-1 justify-center gap-8">
          <button
            data-testid="nav-studio"
            onClick={handleStudioClick}
            className={`text-sm font-medium tracking-wide transition-colors pb-0.5 ${
              isStudio
                ? "text-[#DA2C38] border-b-2 border-[#DA2C38]"
                : "text-[#637083] hover:text-[#1C2025]"
            }`}
            style={{ fontFamily: "Work Sans, sans-serif" }}
          >
            Studio
          </button>
          <button
            data-testid="nav-showcase"
            onClick={() => navigate("/showcase")}
            className={`text-sm font-medium tracking-wide transition-colors pb-0.5 ${
              isShowcase
                ? "text-[#DA2C38] border-b-2 border-[#DA2C38]"
                : "text-[#637083] hover:text-[#1C2025]"
            }`}
            style={{ fontFamily: "Work Sans, sans-serif" }}
          >
            Showcase Room
          </button>
        </div>

        {/* Right: On Air/Exit + Hamburger */}
        <div className="flex items-center gap-2 ml-auto" data-testid="onair-exit-area">
          {/* On Air/Exit label — shorten on small screens */}
          <span className="hidden sm:inline text-sm font-medium text-[#637083] tracking-wide whitespace-nowrap">
            On Air/Exit
          </span>
          <span className="sm:hidden text-xs font-medium text-[#637083] whitespace-nowrap">
            On Air
          </span>

          <Switch
            data-testid="onair-exit-switch"
            checked={onAirExit}
            onCheckedChange={handleOnAirToggle}
            disabled={switchLoading}
            className="data-[state=checked]:bg-[#DA2C38]"
          />

          {/* Hamburger button — mobile only */}
          <button
            className="md:hidden ml-1 p-2 rounded-md text-[#637083] hover:text-[#1C2025] hover:bg-gray-100 transition-colors"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? "Tutup menu" : "Buka menu"}
            data-testid="mobile-menu-btn"
          >
            {mobileMenuOpen
              ? <X className="w-5 h-5" strokeWidth={2} />
              : <Menu className="w-5 h-5" strokeWidth={2} />
            }
          </button>
        </div>
      </nav>

      {/* ── Mobile Dropdown Menu ── */}
      <div
        data-testid="mobile-menu"
        className={`
          md:hidden bg-white border-b border-[#E5E7EB] shadow-lg
          overflow-hidden transition-all duration-200 ease-in-out
          ${mobileMenuOpen ? "max-h-48 opacity-100" : "max-h-0 opacity-0"}
        `}
      >
        <div className="flex flex-col py-1">
          <button
            data-testid="mobile-nav-studio"
            onClick={handleStudioClick}
            className={`flex items-center px-6 py-4 text-sm font-medium tracking-wide transition-colors text-left ${
              isStudio
                ? "text-[#DA2C38] bg-red-50 border-l-2 border-[#DA2C38]"
                : "text-[#637083] hover:text-[#1C2025] hover:bg-gray-50"
            }`}
            style={{ fontFamily: "Work Sans, sans-serif" }}
          >
            Studio
          </button>
          <button
            data-testid="mobile-nav-showcase"
            onClick={() => navigate("/showcase")}
            className={`flex items-center px-6 py-4 text-sm font-medium tracking-wide transition-colors text-left ${
              isShowcase
                ? "text-[#DA2C38] bg-red-50 border-l-2 border-[#DA2C38]"
                : "text-[#637083] hover:text-[#1C2025] hover:bg-gray-50"
            }`}
            style={{ fontFamily: "Work Sans, sans-serif" }}
          >
            Showcase Room
          </button>
        </div>
      </div>
    </div>
  );
}
