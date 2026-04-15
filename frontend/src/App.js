import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import Navbar from "@/components/shared/Navbar";
import Footer from "@/components/shared/Footer";
import ShowcaseRoom from "@/pages/ShowcaseRoom";
import StudioHub from "@/pages/StudioHub";
import StudioNeon from "@/pages/StudioNeon";
import StudioAC from "@/pages/StudioAC";
import StudioACRoom from "@/pages/StudioACRoom";
import StudioHeadlights from "@/pages/StudioHeadlights";
import StudioHeadlightsRoom from "@/pages/StudioHeadlightsRoom";

function App() {
  return (
    <div className="App min-h-screen flex flex-col">
      <BrowserRouter>
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Navigate to="/showcase" replace />} />
            <Route path="/showcase" element={<ShowcaseRoom />} />
            <Route path="/studio" element={<StudioHub />} />
            <Route path="/studio/neon" element={<StudioNeon />} />
            <Route path="/studio/ac" element={<StudioAC />} />
            <Route path="/studio/ac/:roomId" element={<StudioACRoom />} />
            <Route path="/studio/headlights" element={<StudioHeadlights />} />
            <Route path="/studio/headlights/:roomId" element={<StudioHeadlightsRoom />} />
          </Routes>
        </main>
        <Footer />
      </BrowserRouter>
      <Toaster position="top-right" offset={70} richColors />
    </div>
  );
}

export default App;
