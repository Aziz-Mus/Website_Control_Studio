import { useNavigate } from "react-router-dom";
import { Waves, Snowflake, Lamp } from "lucide-react";
import { Button } from "@/components/ui/button";

const categories = [
  {
    id: "neon", label: "AMBIENT SYSTEM", title: "Neon Light Control",
    desc: "Precision setting of decorative and ambient neon.",
    icon: Waves, path: "/studio/neon", color: "#DA2C38",
  },
  {
    id: "ac", label: "TEMPERATURE", title: "AC Control",
    desc: "Manage air conditioning systems by room.",
    icon: Snowflake, path: "/studio/ac", color: "#3B82F6",
  },
  {
    id: "headlights", label: "HEAD LIGHTS", title: "Headlight Control",
    desc: "Controls For Main Lights In Studio Room",
    icon: Lamp, path: "/studio/headlights", color: "#DA2C38",
  },
];

export default function StudioHub() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#F7F8F9]" data-testid="studio-hub-page">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1C2025]" style={{ fontFamily: 'Work Sans, sans-serif' }} data-testid="studio-hub-title">Studio Hub</h1>
          <p className="text-sm text-[#637083] mt-1">Precise studio environment control. Monitor and manage lighting and temperature systems.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat) => (
            <div key={cat.id} data-testid={`studio-card-${cat.id}`}
              className="bg-white border border-[#E5E7EB] rounded-md p-5 hover:shadow-md hover:border-[#DA2C38] transition-all cursor-pointer group"
              onClick={() => navigate(cat.path)}>
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-md flex-shrink-0" style={{ backgroundColor: `${cat.color}10` }}>
                  <cat.icon className="w-6 h-6" style={{ color: cat.color }} strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] uppercase tracking-wider text-[#637083] font-medium">{cat.label}</span>
                  <h3 className="text-base font-semibold text-[#1C2025] mt-0.5" style={{ fontFamily: 'Work Sans, sans-serif' }}>{cat.title}</h3>
                  <p className="text-xs text-[#637083] mt-1 leading-relaxed">{cat.desc}</p>
                  <div className="mt-3">
                    <Button size="sm" className="bg-[#DA2C38] hover:bg-[#B9252F] text-white rounded-md text-xs" data-testid={`${cat.id}-action-btn`}
                      onClick={(e) => { e.stopPropagation(); navigate(cat.path); }}>
                      {cat.id === "neon" ? "Configure Lighting" : "Manage"} &rarr;
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
