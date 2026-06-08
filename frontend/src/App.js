import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import ShowcaseRoom from "@/pages/ShowcaseRoom";
import StudioHub from "@/pages/StudioHub";
import StudioNeon from "@/pages/StudioNeon";
import StudioAC from "@/pages/StudioAC";
import StudioHeadlights from "@/pages/StudioHeadlights";
import CommandCenter from "@/pages/CommandCenter";
import Login from "@/pages/Login";
import axios from "axios";
import { Children } from "react";

// AXIOS GLOBAL INTERCEPTOR
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("api_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
})

// Melindungi Rute
const ProtectedRoute = ({children, allowedRoles}) => {
  const token = localStorage.getItem("api_token");
  const userRole = localStorage.getItem("user_role");
  
  //  jika tidak punya token
  if (!token) return <Navigate to="/login" replace />;

  // Jika role tidak termasuk yang diizinkan
  if (allowedRoles && userRole !== "admin" && !allowedRoles.includes(userRole)) {
    return <Navigate to="/" replace />
  }

  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
};


function App() {
  return (
    <div className="App min-h-screen flex flex-col bg-zinc-950">
      <BrowserRouter>
        {/* <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Navigate to="/showcase" replace />} />
            <Route path="/showcase" element={<ShowcaseRoom />} />
            <Route path="/studio" element={<StudioHub />} />
            <Route path="/studio/neon" element={<StudioNeon />} />
            <Route path="/studio/ac" element={<StudioAC />} />
            <Route path="/studio/ac/:roomId" element={<StudioACRoom />} />
            <Route path="/studio/headlights" element={<StudioHeadlights />} />
            <Route path="/command-center" element={<CommandCenter />} />
          </Routes>
        </main>
        <Footer /> */}
        <Routes>
          {/* Rute bebas akses (Login) */}
          <Route path="/login" element={<Login />} />

          {/* Rute default pengalihan pintu mausk */}
          <Route path="/" element={
              localStorage.getItem("api_token")
                ? <Navigate to="/showcase" replace/>
                : <Navigate to="/login" replace/>
            } 
          />

          {/* Rute yang dibatasi */}
          <Route path="/showcase" element={
              <ProtectedRoute allowedRoles={["showcase_room"]}>
                <ShowcaseRoom />
              </ProtectedRoute>
            }
          />
          <Route path="/command-center" element={
              <ProtectedRoute allowedRoles={["command_center"]}>
                <CommandCenter />
              </ProtectedRoute>
            }
          />
          <Route path="/studio/neon" element={
              <ProtectedRoute allowedRoles={["studio_all", "studio_neon_control"]}>
                <StudioNeon />
              </ProtectedRoute>
            }
          />
          <Route path="/studio/ac" element={
              <ProtectedRoute allowedRoles={["studio_all", "studio_ac_control"]}>
                <StudioAC />
              </ProtectedRoute>
            }
          />
          <Route path="/studio/headlights" element={
              <ProtectedRoute allowedRoles={["studio_all", "studio_main_headlight"]}>
                <StudioHeadlights />
              </ProtectedRoute>
            }
          />
          <Route path="/studio" element={
              <ProtectedRoute allowedRoles={["studio_all", "studio_neon_control", "studio_ac_control", "studio_main_headlight"]}>
                <StudioHub />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" offset={70} richColors theme="dark"/>
    </div>
  );
}

export default App;
