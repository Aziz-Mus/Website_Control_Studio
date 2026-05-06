import { useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors, useDroppable, useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Lightbulb, AlertTriangle, Trash2, Pencil, Plus } from "lucide-react";

// ── Card sizes based on column count ────────────────────────────────────────
const cardSizeClass = (cols) => {
  if (cols <= 2) return { text: "text-sm", icon: "w-8 h-8", pad: "p-4" };
  if (cols <= 4) return { text: "text-xs", icon: "w-6 h-6", pad: "p-3" };
  if (cols <= 6) return { text: "text-[10px]", icon: "w-5 h-5", pad: "p-2" };
  return { text: "text-[9px]", icon: "w-4 h-4", pad: "p-1.5" };
};

// Icon mode card dimensions — controls how big the card is inside the cell
const iconCardSize = (cols) => {
  if (cols <= 2) return { w: 100, h: 100, icon: "w-12 h-12" };
  if (cols <= 4) return { w: 90, h: 90, icon: "w-11 h-11" };
  if (cols <= 6) return { w: 80, h: 80, icon: "w-10 h-10" };
  return { w: 70, h: 70, icon: "w-9 h-9" };
};

// ── Detailed device card ───────────────────────────────────────────────────────
function DeviceCard({ device, isSelected, status, onToggle, onEdit, onDelete, sizes, dragging = false }) {
  const st = status || "idle";
  const bc = isSelected ? "border-[#DA2C38]" : "border-[#E5E7EB]";
  const bg = st === "on" ? "bg-red-50" : st === "failed" ? "bg-yellow-50" : isSelected ? "bg-red-50" : "bg-gray-50";

  return (
    <div
      className={`relative w-full h-full border-2 rounded-md bg-white cursor-pointer transition-all select-none overflow-hidden ${bc} ${dragging ? "opacity-50 shadow-2xl scale-105" : "hover:shadow-sm"}`}
      onClick={() => !dragging && onToggle?.(device.kode)}
    >
      {st === "failed" && (
        <div className="absolute top-1 left-1 z-10">
          <AlertTriangle className="w-2.5 h-2.5 text-[#F59E0B]" />
        </div>
      )}
      <div className="flex flex-col items-center justify-center h-full p-1.5 gap-0.5">
        <div className={`${bg} rounded-md p-1.5`}>
          <Lightbulb className={`${sizes.icon} ${st === "on" ? "text-[#DA2C38]" : st === "failed" ? "text-[#F59E0B]" : isSelected ? "text-[#DA2C38]" : "text-[#637083]"}`} strokeWidth={1.5} />
        </div>
        <div className="w-full flex flex-col items-center justify-center overflow-hidden">
          <p className={`${sizes.text} font-bold text-[#1C2025] truncate w-full text-center leading-normal px-1`} title={device.nama}>
            {device.nama}
          </p>
          {device.ip && (
            <p className="text-[8px] text-[#9CA3AF] truncate w-full text-center leading-normal" title={device.ip}>
              {device.ip}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <div className={`w-1 h-1 rounded-full ${st === "on" ? "bg-[#10B981]" : st === "failed" ? "bg-[#F59E0B]" : "bg-[#D1D5DB]"}`} />
          <span className="text-[9px] font-bold tracking-tight text-[#637083]">
            {st === "on" ? "ON" : st === "failed" ? "FAIL" : st === "off" ? "OFF" : "IDLE"}
          </span>
        </div>
      </div>
      <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-20"
        onClick={e => e.stopPropagation()}>
        {onEdit && <button className="p-0.5 rounded hover:bg-blue-50" onClick={() => onEdit(device)}>
          <Pencil className="w-2.5 h-2.5 text-[#637083]" strokeWidth={1.5} />
        </button>}
        <button className="p-0.5 rounded hover:bg-red-50" onClick={() => onDelete(device.kode)}>
          <Trash2 className="w-2.5 h-2.5 text-[#637083]" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

// ── Icon-only device card — compact, centered in cell ──────────────────────
function IconOnlyCard({ device, isSelected, status, onToggle, cols, dragging = false }) {
  const st = status || "idle";
  const bc = isSelected ? "border-[#DA2C38]" : "border-transparent";
  const bg = st === "on" ? "bg-red-50" : st === "failed" ? "bg-yellow-50" : isSelected ? "bg-red-50" : "bg-gray-50";
  const card = iconCardSize(cols);

  return (
    <div
      className="relative flex items-center justify-center w-full h-full cursor-pointer select-none"
      onClick={() => !dragging && onToggle?.(device.kode)}
    >
      {st === "failed" && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
          <AlertTriangle className="w-2 h-2 text-[#F59E0B]" />
        </div>
      )}
      <div
        className={`flex items-center justify-center rounded-lg border-2 ${bc} ${bg} transition-colors ${dragging ? "opacity-50 shadow-2xl scale-110" : "hover:shadow-sm"}`}
        style={{ width: card.w, height: card.h }}
      >
        <Lightbulb className={`${card.icon} ${st === "on" ? "text-[#DA2C38]" : st === "failed" ? "text-[#F59E0B]" : isSelected ? "text-[#DA2C38]" : "text-[#637083]"}`} strokeWidth={1.5} />
      </div>
    </div>
  );
}


// ── Draggable wrapper ───────────────────────────────────────────────────────
function DraggableCard({ cellIdx, children }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: String(cellIdx) });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      style={{ transform: CSS.Transform.toString(transform), touchAction: "none", height: "100%", opacity: isDragging ? 0.4 : 1 }}>
      {children}
    </div>
  );
}

// ── Droppable cell ──────────────────────────────────────────────────────────
function DroppableCell({ cellIdx, children }) {
  const { isOver, setNodeRef } = useDroppable({ id: String(cellIdx) });
  return (
    <div ref={setNodeRef} className="h-full"
      style={{ background: isOver ? "rgba(218,44,56,0.05)" : undefined,
               outline: isOver ? "2px dashed #DA2C38" : undefined, outlineOffset: -2, borderRadius: 6 }}>
      {children}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function DeviceModuleGrid({
  devices = [],
  selectedIds = [],
  deviceStatuses = {},
  viewMode = "list",
  gridConfig = { cols: 4, rows: 5 },
  gridLayout = {},
  gridMode = "control",
  displayMode = "detailed",
  onToggleSelect,
  onDelete,
  onEdit,
  onAddAtCell,
  onLayoutChange,
  onViewModeChange,
  onGridModeChange,
  onGridConfigOpen,
  onDisplayModeChange,
}) {
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const sizes = cardSizeClass(gridConfig.cols);
  const kodeMap = Object.fromEntries(devices.map(d => [d.kode, d]));

  const handleDragStart = ({ active }) => setActiveId(active.id);

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const from = active.id;
    const to   = over.id;
    const newLayout = { ...gridLayout };
    const fromKode = newLayout[from];
    const toKode   = newLayout[to];
    if (toKode !== undefined) {
      newLayout[to]   = fromKode;
      newLayout[from] = toKode;
    } else {
      newLayout[to] = fromKode;
      delete newLayout[from];
    }
    onLayoutChange?.(newLayout);
  };

  const activeDragKode = activeId !== null ? gridLayout[activeId] : null;
  const activeDragDevice = activeDragKode ? kodeMap[activeDragKode] : null;

  const renderCard = (device, extraProps = {}) => {
    if (displayMode === "icon") {
      return (
        <IconOnlyCard
          device={device}
          isSelected={selectedIds.includes(device.kode)}
          status={deviceStatuses[device.kode]}
          onToggle={onToggleSelect}
          cols={gridConfig.cols}
          {...extraProps}
        />
      );
    }
    return (
      <DeviceCard
        device={device}
        isSelected={selectedIds.includes(device.kode)}
        status={deviceStatuses[device.kode]}
        onToggle={onToggleSelect}
        onEdit={onEdit}
        onDelete={onDelete}
        sizes={sizes}
        {...extraProps}
      />
    );
  };

  // ── LIST MODE ──────────────────────────────────────────────────────────────
  if (viewMode === "list") {
    if (!devices.length) {
      return (
        <div className="text-center py-12 text-[#637083]">
          <Lightbulb className="w-12 h-12 mx-auto mb-3 text-[#D1D5DB]" strokeWidth={1.5} />
          <p className="text-sm">No lights added yet.</p>
          <p className="text-xs mt-1">Click "Add Light" to add a new light.</p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {devices.map(device => (
          <div key={device.kode} className="group" style={{ height: 120 }}>
            <DeviceCard
              device={device}
              isSelected={selectedIds.includes(device.kode)}
              status={deviceStatuses[device.kode]}
              onToggle={onToggleSelect}
              onEdit={onEdit}
              onDelete={onDelete}
              sizes={cardSizeClass(5)}
            />
          </div>
        ))}
      </div>
    );
  }

  // ── GRID TABLE MODE ────────────────────────────────────────────────────────
  const { cols, rows } = gridConfig;
  const totalCells = cols * rows;
  const isIconMode = displayMode === "icon";

  // Cell dimensions
  const cellMinW = isIconMode ? 60 : 100;   // min-width per cell (for mobile scroll)
  const cellH = isIconMode
    ? Math.max(90, Math.min(120, Math.round(120 - cols * 1.5)))
    : Math.max(100, Math.min(160, Math.round(150 - cols * 6)));

  // Padding inside each cell — icon mode has more margin
  const cellPadding = isIconMode ? "4px" : "6px";

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {/* Horizontal scroll wrapper for mobile when cols > 4 */}
      <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isIconMode 
              ? `repeat(${cols}, ${cellH}px)` 
              : `repeat(${cols}, minmax(${cellMinW}px, 1fr))`,
            gap: 0,
            border: "1px solid #E5E7EB",
            borderRadius: 8,
            overflow: "hidden",
            minWidth: isIconMode ? undefined : (cols > 4 ? `${cols * cellMinW}px` : undefined),
            width: isIconMode ? "fit-content" : "100%",
            margin: isIconMode ? "0 auto" : undefined,
          }}
        >
          {Array.from({ length: totalCells }).map((_, cellIdx) => {
            const kode   = gridLayout[String(cellIdx)];
            const device = kode !== undefined ? kodeMap[kode] : null;
            const hasDevice = device !== null && device !== undefined;

            return (
              <DroppableCell key={cellIdx} cellIdx={cellIdx}>
                <div style={{
                  height: cellH,
                  borderRight: (cellIdx % cols) !== cols - 1 ? "1px solid #E5E7EB" : "none",
                  borderBottom: Math.floor(cellIdx / cols) !== rows - 1 ? "1px solid #E5E7EB" : "none",
                  padding: cellPadding,
                  boxSizing: "border-box",
                }}>
                  {hasDevice ? (
                    gridMode === "edit" ? (
                      <DraggableCard cellIdx={cellIdx}>
                        <div className="group" style={{ height: "100%" }}>
                          {renderCard(device)}
                        </div>
                      </DraggableCard>
                    ) : (
                      <div className="group" style={{ height: "100%" }}>
                        {renderCard(device)}
                      </div>
                    )
                  ) : (
                    gridMode === "edit" ? (
                      <button
                        className="w-full h-full rounded-md border-2 border-dashed border-[#E5E7EB] flex items-center justify-center text-[#D1D5DB] hover:border-[#DA2C38] hover:text-[#DA2C38] transition-colors"
                        onClick={() => onAddAtCell?.(cellIdx)}
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    ) : (
                      <div className="w-full h-full rounded-md bg-[#FAFAFA]" />
                    )
                  )}
                </div>
              </DroppableCell>
            );
          })}
        </div>
      </div>

      <DragOverlay>
        {activeDragDevice ? (
          <div style={{ width: 100, height: cellH, opacity: 0.9 }}>
            {renderCard(activeDragDevice, { dragging: true })}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}