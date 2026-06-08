import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import axios from "axios";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const isStudio = location.pathname.startsWith("/studio");
  const isShowcase = location.pathname.startsWith("/showcase");
  const isCC = location.pathname.startsWith("/command-center");

  const role = localStorage.getItem("user_role");

  const studioRoles = ['admin', 'studio_all', 'studio_neon_control', 'studio_main_headlight', 'studio_ac_control'];

  const username = localStorage.getItem("username");

  const getStudioTarget = () => {
    if (role === 'studio_neon_control') return '/studio/neon';
    if (role === 'studio_main_headlight') return '/studio/headlight';
    if (role === 'studio_ac_control') return '/studio/ac';
    const last = localStorage.getItem('lastStudioPage');
    return (last && last !== '/studio') ? last : '/studio';
  }

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

  // Remember last studio page (including hub itself)
  useEffect(() => {
    if (location.pathname.startsWith("/studio")) {
      localStorage.setItem("lastStudioPage", location.pathname);
    }
  }, [location.pathname]);

  const handleStudioClick = () => {
    navigate(getStudioTarget());
  };

  const handleLogout = () => {
    localStorage.removeItem("api_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("username");
    localStorage.removeItem("lastStudioPage");
    navigate("/login");
  }

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
          onClick={handleStudioClick}
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
            data-testid="nav-command-center"
            onClick={() => navigate("/command-center")}
            className={`text-sm font-medium tracking-wide transition-colors pb-0.5 ${
              !['admin', 'command_center'].includes(role)
                ? "text-[#637083] opacity-40 pointer-events-none cursor-not-allowed"
                : isCC
                  ? "text-[#DA2C38] border-b-2 border-[#DA2C38]"
                  : "text-[#637083] hover:text-[#1C2025]"
            }`}
            style={{ fontFamily: "Work Sans, sans-serif" }}
          >
            Command Center
          </button>
          <button
            data-testid="nav-studio"
            onClick={handleStudioClick}
            className={`text-sm font-medium tracking-wide transition-colors pb-0.5 ${
              !studioRoles.includes(role)
                ? "text-[#637083] opacity-40 pointer-events-none cursor-not-allowed"
                : isStudio
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
              !['admin', 'showcase_room'].includes(role)
                ? "text-[#637083] opacity-40 pointer-events-none cursor-not-allowed"
                : isShowcase
                  ? "text-[#DA2C38] border-b-2 border-[#DA2C38]"
                  : "text-[#637083] hover:text-[#1C2025]"
            }`}
            style={{ fontFamily: "Work Sans, sans-serif" }}
          >
            Showcase Room
          </button>
        </div>


        {/* Right: Hamburger */}
        <div className="flex items-center ml-auto">
          {/* Dekstop: Username + Sign Out */}
          {username && (
            <div className="hidden md:flex items-center gap-3 mr-3">
              {/* Username */}
              <span className="text-sm font-medium text-[#1C2025]" style={{fontFamily: "Work Sans, sans-serif"}}>
                {username}
              </span>

              <div className="w-px h-4 bg-gray-300" />

              {/* Sign Out button */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="px-3 py-1.5 bg-[#DA2C38] hover:bg-[#b52330] text-white text-xs font-semibold rounded-md transition-colors" style={{fontFamily: "Work Sans, sans-serif"}}>
                    Sign Out
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Logout Confirmation</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to log out? You will need to sign in again to access the system.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleLogout}
                      className="bg-[#DA2C38] hover:bg-[#b52330] text-white"
                    >
                      Sign Out
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

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
          ${mobileMenuOpen ? "max-h-64 opacity-100" : "max-h-0 opacity-0"}
        `}
      >
        <div className="flex flex-col py-1">
          <button
            data-testid="mobile-nav-studio"
            onClick={handleStudioClick}
            className={`flex items-center px-6 py-4 text-sm font-medium tracking-wide transition-colors text-left ${
              !studioRoles.includes(role)
                ? "text-[#637083] opacity-40 pointer-events-none cursor-not-allowed"
                : isStudio
                  ? "text-[#DA2C38] bg-red-50 border-l-2 border-[#DA2C38]"
                  : "text-[#637083] hover:bg-gray-50 hover:text-[#1C2025] border-l-2 border-transparent"
            }`}
            style={{ fontFamily: "Work Sans, sans-serif" }}
          >
            Studio
          </button>
          <button
            data-testid="mobile-nav-showcase"
            onClick={() => navigate("/showcase")}
            className={`flex items-center px-6 py-4 text-sm font-medium tracking-wide transition-colors text-left ${
              !['admin', 'showcase_room'].includes(role)
                ? "text-[#637083] opacity-40 pointer-events-none cursor-not-allowed"
                : isShowcase
                  ? "text-[#DA2C38] bg-red-50 border-l-2 border-[#DA2C38]"
                  : "text-[#637083] hover:bg-gray-50 hover:text-[#1C2025] border-l-2 border-transparent"
            }`}
            style={{ fontFamily: "Work Sans, sans-serif" }}
          >
            Showcase Room
          </button>
          <button
            data-testid="mobile-nav-command-center"
            onClick={() => navigate("/command-center")}
            className={`flex items-center px-6 py-4 text-sm font-medium tracking-wide transition-colors text-left ${
              !['admin', 'command_center'].includes(role)
                ? "text-[#637083] opacity-40 pointer-events-none cursor-not-allowed"
                : isCC
                  ? "text-[#DA2C38] bg-red-50 border-l-2 border-[#DA2C38]"
                  : "text-[#637083] hover:bg-gray-50 hover:text-[#1C2025] border-l-2 border-transparent"
            }`}
            style={{ fontFamily: "Work Sans, sans-serif" }}
          >
            Command Center
          </button>

          {/* Mobile username + sign out */}
          {username && <div className="border-t border-[#E5E7EB] mx-4 my-1"/>}

          {username && (
            <div className="flex items-center justify-end px-6 py-3">
              {/* Username */}
              <span className="text-sm font-medium text-[#1C2025]" style={{fontFamily: "Work Sans, sans-serif"}}>
                {username}
              </span>

              <div className="w-px h-4 bg-gray-300 mx-3" />

              {/* Button Sign Out */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="px-3 py-1.5 bg-[#DA2C38] hover:bg-[#b52330] text-white text-xs font-semibold rounded-md transition-colors" style={{fontFamily: "Work Sans, sans-serif"}}>
                    Sign Out
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Logout Confirmation</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to log out? You will need to sign in again to access the system.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter >
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleLogout}
                      className="bg-[#DA2C38] hover:bg-[#b52330] text-white"
                    >
                      Sign Out
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
