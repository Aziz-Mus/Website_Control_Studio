import { Sun, Power } from "lucide-react";

// Accepts: total, onCount, failedCount
export default function MasterStatus({ total, onCount = 0, failedCount = 0 }) {
  const offCount = total - onCount - failedCount;
  const status = total === 0 ? "empty"
    : onCount === total ? "all_active"
    : onCount > 0 || failedCount > 0 ? "partially_active"
    : "all_inactive";

  const statusLabel = { empty: "NO DEVICES", all_active: "ALL ACTIVE", partially_active: "PARTIALLY ACTIVE", all_inactive: "ALL INACTIVE" }[status];
  const statusColor = { empty: "text-[#637083]", all_active: "text-[#10B981]", partially_active: "text-[#DA2C38]", all_inactive: "text-[#637083]" }[status];
  const borderColor = { empty: "border-[#E5E7EB]", all_active: "border-[#10B981]", partially_active: "border-[#DA2C38]", all_inactive: "border-[#E5E7EB]" }[status];

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-md p-4 space-y-3" data-testid="master-status">
      <h3 className="text-xs uppercase tracking-wider text-[#637083] font-medium" style={{ fontFamily: 'Work Sans, sans-serif' }}>
        Master Light Status
      </h3>
      <div className={`border ${borderColor} rounded-md p-4 flex items-center gap-3`}>
        <div className={`p-2 rounded-md ${status === "all_active" || status === "partially_active" ? "bg-red-50" : "bg-gray-50"}`}>
          {status === "all_inactive" || status === "empty" ? (
            <Power className="w-6 h-6 text-[#637083]" strokeWidth={1.5} />
          ) : (
            <Sun className="w-6 h-6 text-[#DA2C38]" strokeWidth={1.5} />
          )}
        </div>
        <div>
          <p className={`text-sm font-semibold ${statusColor}`}>{statusLabel}</p>
          <p className="text-xs text-[#637083]">{onCount} / {total} Active</p>
        </div>
      </div>
      {failedCount > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
          <span className="text-[#F59E0B] font-medium">{failedCount} FAILED</span>
        </div>
      )}
      <div className="space-y-1.5">
        {["all_active", "partially_active", "all_inactive"].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${status === s ? "bg-[#DA2C38]" : "bg-[#D1D5DB]"}`} />
            <span className={`text-xs ${status === s ? "text-[#DA2C38] font-medium" : "text-[#637083]"}`}>
              {s === "all_active" ? "ALL ACTIVE" : s === "partially_active" ? "PARTIALLY ACTIVE" : "ALL INACTIVE"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
