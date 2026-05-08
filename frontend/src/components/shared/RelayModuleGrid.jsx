import { useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors, useDroppable, useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Lamp, AlertTriangle, Trash2, Pencil, Plus, Power } from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Card size helpers ──────────────────────────────────────────────────────────
const cardSizeClass = (cols) => {
  if (cols <= 2) return { text: "text-sm",    icon: "w-8 h-8", pad: "p-4" };
  if (cols <= 4) return { text: "text-xs",    icon: "w-6 h-6", pad: "p-3" };
  if (cols <= 6) return { text: "text-[10px]",icon: "w-5 h-5", pad: "p-2" };
  return           { text: "text-[9px]",  icon: "w-4 h-4", pad: "p-1.5" };
};

const iconCardSize = (cols) => {
  if (cols <= 2) return { w: 100, h: 100, icon: "w-12 h-12" };
  if (cols <= 4) return { w: 90,  h: 90,  icon: "w-10 h-10" };
  if (cols <= 6) return { w: 80,  h: 80,  icon: "w-9 h-9"  };
  return           { w: 70,  h: 70,  icon: "w-8 h-8"  };
};

// ── Detailed Relay Card ────────────────────────────────────────────────────────
function RelayCard({ relay, isSelected, status, onToggleSelect, onControlSingle, onEdit, onDelete, sizes, dragging = false }) {
  const st = status || "idle";
  const bc = isSelected ? "border-[#DA2C38]" : "border-[#E5E7EB]";
  const bg = st === "on" ? "bg-red-50" : st === "failed" ? "bg-yellow-50" : isSelected ? "bg-red-50" : "bg-gray-50";

  return (
    <div
      className={`relative w-full h-full border-2 rounded-md bg-white cursor-pointer transition-all select-none overflow-hidden group ${bc} ${dragging ? "opacity-50 shadow-2xl scale-105" : "hover:shadow-sm"}`}
      onClick={() => !dragging && onToggleSelect?.(relay.relayId)}
    >
      {st === "failed" && (
        <div className="absolute top-1 left-1 z-10">
          <AlertTriangle className="w-2.5 h-2.5 text-[#F59E0B]" />
        </div>
      )}
      <div className="flex flex-col items-center justify-center h-full p-1.5 gap-0.5">
        <div className={`${bg} rounded-md p-1.5`}>
          <Lamp
            className={`${sizes.icon} ${st === "on" ? "text-[#DA2C38]" : st === "failed" ? "text-[#F59E0B]" : isSelected ? "text-[#DA2C38]" : "text-[#637083]"}`}
            strokeWidth={1.5}
          />
        </div>
        <div className="w-full flex flex-col items-center justify-center overflow-hidden">
          <p className={`${sizes.text} font-bold text-[#1C2025] truncate w-full text-center leading-normal px-1`} title={relay.deviceName}>
            {relay.deviceName}
          </p>
          <p className="text-[8px] text-[#9CA3AF] truncate w-full text-center leading-normal">
            CH {relay.channelCode}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <div className={`w-1 h-1 rounded-full ${st === "on" ? "bg-[#10B981]" : st === "failed" ? "bg-[#F59E0B]" : "bg-[#D1D5DB]"}`} />
          <span className="text-[9px] font-bold tracking-tight text-[#637083]">
            {st === "on" ? "ON" : st === "failed" ? "FAIL" : st === "off" ? "OFF" : "IDLE"}
          </span>
        </div>
        {/* ON/OFF buttons per card */}
        <div className="flex gap-1 w-full px-1 mt-0.5" onClick={e => e.stopPropagation()}>
          <button
            className={`flex-1 py-0.5 rounded text-[8px] font-bold transition-colors ${st === "on" ? "bg-[#DA2C38] text-white" : "bg-gray-100 text-[#637083] hover:bg-[#DA2C38] hover:text-white"}`}
            onClick={() => onControlSingle?.(relay, "on")}
          >ON</button>
          <button
            className={`flex-1 py-0.5 rounded text-[8px] font-bold transition-colors ${st === "off" ? "bg-[#374151] text-white" : "bg-gray-100 text-[#637083] hover:bg-[#374151] hover:text-white"}`}
            onClick={() => onControlSingle?.(relay, "off")}
          >OFF</button>
        </div>
      </div>
      {/* Edit / Delete hover */}
      <div className="absolute top-0.5 right-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-20"
        onClick={e => e.stopPropagation()}>
        {onEdit && (
          <button className="p-0.5 rounded hover:bg-blue-50" onClick={() => onEdit(relay)}>
            <Pencil className="w-2.5 h-2.5 text-[#637083]" strokeWidth={1.5} />
          </button>
        )}
        <button className="p-0.5 rounded hover:bg-red-50" onClick={() => onDelete?.(relay.relayId)}>
          <Trash2 className="w-2.5 h-2.5 text-[#637083]" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

// ── Icon-only Relay Card ───────────────────────────────────────────────────────
function IconOnlyRelayCard({ relay, isSelected, status, onToggleSelect, onControlSingle, cols, dragging = false }) {
  const st = status || "idle";
  const bc = isSelected ? "border-[#DA2C38]" : "border-transparent";
  const bg = st === "on" ? "bg-red-50" : st === "failed" ? "bg-yellow-50" : isSelected ? "bg-red-50" : "bg-gray-50";
  const card = iconCardSize(cols);

  return (
    <div
      className="relative flex flex-col items-center justify-center w-full h-full cursor-pointer select-none gap-1"
      onClick={() => !dragging && onToggleSelect?.(relay.relayId)}
    >
      {st === "failed" && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
          <AlertTriangle className="w-2 h-2 text-[#F59E0B]" />
        </div>
      )}
      <div
        className={`flex items-center justify-center rounded-lg border-2 ${bc} ${bg} transition-colors ${dragging ? "opacity-50 shadow-2xl scale-110" : "hover:shadow-sm"}`}
        style={{ width: card.w, height: card.h - 22 }}
      >
        <Lamp
          className={`${card.icon} ${st === "on" ? "text-[#DA2C38]" : st === "failed" ? "text-[#F59E0B]" : isSelected ? "text-[#DA2C38]" : "text-[#637083]"}`}
          strokeWidth={1.5}
        />
      </div>
      {/* Single toggle ON/OFF button */}
      <button
        className={`px-2 py-0.5 rounded text-[8px] font-bold transition-colors ${st === "on" ? "bg-[#DA2C38] text-white" : "bg-gray-200 text-[#637083] hover:bg-[#DA2C38] hover:text-white"}`}
        onClick={e => { e.stopPropagation(); onControlSingle?.(relay, st === "on" ? "off" : "on"); }}
      >
        <Power className="w-2.5 h-2.5" strokeWidth={2} />
      </button>
    </div>
  );
}

// ── DnD Wrappers ──────────────────────────────────────────────────────────────
function DraggableCard({ cellIdx, children }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: String(cellIdx) });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      style={{ transform: CSS.Transform.toString(transform), touchAction: "none", height: "100%", opacity: isDragging ? 0.4 : 1 }}>
      {children}
    </div>
  );
}

function DroppableCell({ cellIdx, children }) {
  const { isOver, setNodeRef } = useDroppable({ id: String(cellIdx) });
  return (
    <div ref={setNodeRef} className="h-full"
      style={{
        background: isOver ? "rgba(218,44,56,0.05)" : undefined,
        outline: isOver ? "2px dashed #DA2C38" : undefined,
        outlineOffset: -2,
        borderRadius: 6,
      }}>
      {children}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
/**
 * RelayModuleGrid
 * Props:
 *   relays           : [{ relayId, deviceName, channelCode }]
 *   selectedIds      : [relayId]
 *   relayStatuses    : { relayId: "on"|"off"|"failed"|"idle" }
 *   viewMode         : "list" | "grid"
 *   gridConfig       : { cols, rows }
 *   gridLayout       : { cellIdx(str): relayId(str) }
 *   gridMode         : "edit" | "control"
 *   displayMode      : "detailed" | "icon"
 *   onToggleSelect   : (relayId) => void
 *   onControlSingle  : (relay, action) => void
 *   onDelete         : (relayId) => void
 *   onEdit           : (relay) => void
 *   onAddAtCell      : (cellIdx) => void
 *   onLayoutChange   : (newLayout) => void
 */
export default function RelayModuleGrid({
  relays = [],
  selectedIds = [],
  relayStatuses = {},
  viewMode = "list",
  gridConfig = { cols: 4, rows: 5 },
  gridLayout = {},
  gridMode = "control",
  displayMode = "detailed",
  onToggleSelect,
  onControlSingle,
  onDelete,
  onEdit,
  onAddAtCell,
  onLayoutChange,
}) {
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const sizes = cardSizeClass(gridConfig.cols);
  const relayMap = Object.fromEntries(relays.map(r => [r.relayId, r]));

  const handleDragStart = ({ active }) => setActiveId(active.id);
  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const newLayout = { ...gridLayout };
    const fromId = newLayout[active.id];
    const toId   = newLayout[over.id];
    if (toId !== undefined) {
      newLayout[over.id]   = fromId;
      newLayout[active.id] = toId;
    } else {
      newLayout[over.id] = fromId;
      delete newLayout[active.id];
    }
    onLayoutChange?.(newLayout);
  };

  const activeDragRelayId = activeId !== null ? gridLayout[activeId] : null;
  const activeDragRelay   = activeDragRelayId ? relayMap[activeDragRelayId] : null;

  const renderCard = (relay, extraProps = {}) => {
    if (displayMode === "icon") {
      return (
        <IconOnlyRelayCard
          relay={relay}
          isSelected={selectedIds.includes(relay.relayId)}
          status={relayStatuses[relay.relayId]}
          onToggleSelect={onToggleSelect}
          onControlSingle={onControlSingle}
          cols={gridConfig.cols}
          {...extraProps}
        />
      );
    }
    return (
      <RelayCard
        relay={relay}
        isSelected={selectedIds.includes(relay.relayId)}
        status={relayStatuses[relay.relayId]}
        onToggleSelect={onToggleSelect}
        onControlSingle={onControlSingle}
        onEdit={onEdit}
        onDelete={onDelete}
        sizes={sizes}
        {...extraProps}
      />
    );
  };

  // ── LIST MODE ──────────────────────────────────────────────────────────────
  if (viewMode === "list") {
    if (!relays.length) {
      return (
        <div className="text-center py-12 text-[#637083]">
          <Lamp className="w-12 h-12 mx-auto mb-3 text-[#D1D5DB]" strokeWidth={1.5} />
          <p className="text-sm">No headlights added yet.</p>
          <p className="text-xs mt-1">Click "Add Headlight" to get started.</p>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {relays.map(relay => (
          <div key={relay.relayId} className="group" style={{ height: 128 }}>
            <RelayCard
              relay={relay}
              isSelected={selectedIds.includes(relay.relayId)}
              status={relayStatuses[relay.relayId]}
              onToggleSelect={onToggleSelect}
              onControlSingle={onControlSingle}
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

  const cellMinW = isIconMode ? 60 : 100;
  const cellH = isIconMode
    ? Math.max(90, Math.min(120, Math.round(120 - cols * 1.5)))
    : Math.max(100, Math.min(160, Math.round(150 - cols * 6)));
  const cellPadding = isIconMode ? "4px" : "6px";

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
            minWidth: `${cols * (isIconMode ? cellH : cellMinW)}px`,
            width: isIconMode ? "fit-content" : "100%",
            margin: isIconMode ? "0 auto" : undefined,
          }}
        >
          {Array.from({ length: totalCells }).map((_, cellIdx) => {
            const relayId = gridLayout[String(cellIdx)];
            const relay   = relayId ? relayMap[relayId] : null;
            const hasRelay = relay !== null && relay !== undefined;

            return (
              <DroppableCell key={cellIdx} cellIdx={cellIdx}>
                <div style={{
                  height: cellH,
                  borderRight:  (cellIdx % cols) !== cols - 1 ? "1px solid #E5E7EB" : "none",
                  borderBottom: Math.floor(cellIdx / cols) !== rows - 1 ? "1px solid #E5E7EB" : "none",
                  padding: cellPadding,
                  boxSizing: "border-box",
                }}>
                  {hasRelay ? (
                    gridMode === "edit" ? (
                      <DraggableCard cellIdx={cellIdx}>
                        <div className="group" style={{ height: "100%" }}>
                          {renderCard(relay)}
                        </div>
                      </DraggableCard>
                    ) : (
                      <div className="group" style={{ height: "100%" }}>
                        {renderCard(relay)}
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
        {activeDragRelay ? (
          <div style={{ width: 100, height: cellH, opacity: 0.9 }}>
            {renderCard(activeDragRelay, { dragging: true })}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
