import { Power, PowerOff } from "lucide-react";
import AdvancedColorPicker from "./AdvancedColorPicker";
import PresetManager from "./PresetManager";
import AnimationPanel from "./AnimationPanel";
import SchedulerPanel from "../shared/SchedulerPanel";

const TABS = ["Color", "Presets", "Animation", "Scheduler"];

/**
 * ControlPanel — right-side control panel for Command Center.
 *
 * Props:
 *   selectedCount  : number
 *   tab            : string
 *   onTabChange    : (tab) => void
 *   brightness     : number (0-255)
 *   onBrightnessChange : (v) => void
 *   onPowerOn      : () => void
 *   onPowerOff     : () => void
 *   onColorChange  : (payload) => void
 *   onApplyColor   : () => void
 *   presets        : []
 *   onApplyPreset  : (p) => void
 *   onSavePreset   : (name) => void
 *   onDeletePreset : (id) => void
 *   currentSettings: {}
 *   animations     : []
 *   animState      : {}
 *   interval       : number
 *   onIntervalChange : (v) => void
 *   selectedIps    : string[]
 *   onPlayAnim     : (anim) => void
 *   onStopAnim     : () => void
 *   onDeleteAnim   : (id) => void
 *   onSaveAnim     : (name, frames) => void
 */
export default function ControlPanel({
  selectedCount = 0,
  tab = "Color", onTabChange,
  brightness, onBrightnessChange,
  onPowerOn, onPowerOff,
  onColorChange, onApplyColor,
  presets, onApplyPreset, onSavePreset, onDeletePreset, currentSettings, activePresetId = null,
  animations, animState, interval, onIntervalChange,
  selectedIps, onPlayAnim, onStopAnim, onDeleteAnim, onSaveAnim,
  roomId, selections, devices,
}) {
  const noSelection = selectedCount === 0;

  return (
    <div className="flex flex-col bg-white border border-[#E5E7EB] rounded-lg overflow-hidden">
      {/* Header — selection count + power buttons */}
      <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#FAFAFA]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-[#637083] font-medium">Selected</p>
            <p className="text-2xl font-bold text-[#1C2025]" style={{ fontFamily: "Work Sans, sans-serif" }}>
              {selectedCount}
              <span className="text-sm font-normal text-[#9CA3AF] ml-1">light{selectedCount !== 1 ? "s" : ""}</span>
            </p>
          </div>
          {noSelection && (
            <span className="text-[10px] text-[#F59E0B] bg-yellow-50 border border-yellow-200 px-2 py-1 rounded-full">
              Select lights first
            </span>
          )}
        </div>

        {/* Power buttons */}
        <div className="flex gap-2">
          <button
            onClick={onPowerOn}
            disabled={noSelection}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md bg-[#DA2C38] text-white hover:bg-[#B9252F] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Power className="w-4 h-4" /> ON
          </button>
          <button
            onClick={onPowerOff}
            disabled={noSelection}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md border border-[#E5E7EB] text-[#637083] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <PowerOff className="w-4 h-4" /> OFF
          </button>
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex border-b border-[#E5E7EB]">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => onTabChange?.(t)}
            className={`flex-1 py-2.5 text-xs font-medium tracking-wide transition-colors ${
              tab === t
                ? "text-[#DA2C38] border-b-2 border-[#DA2C38] bg-white"
                : "text-[#637083] hover:text-[#1C2025] hover:bg-gray-50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={`flex-1 overflow-y-auto ${tab === "Scheduler" ? "p-0" : "p-4"}`}>
        {tab === "Color" && (
          <div className="space-y-3">
            <AdvancedColorPicker
              brightness={brightness}
              onBrightnessChange={onBrightnessChange}
              onColorChange={onColorChange}
            />
            <button
              onClick={onApplyColor}
              disabled={noSelection}
              className="w-full py-2.5 text-sm font-medium rounded-md bg-[#DA2C38] text-white hover:bg-[#B9252F] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Apply to Selected Lights
            </button>
          </div>
        )}

        {tab === "Presets" && (
          <PresetManager
            presets={presets}
            onApply={onApplyPreset}
            onSave={onSavePreset}
            onDelete={onDeletePreset}
            currentSettings={currentSettings}
            activePresetId={activePresetId}
          />
        )}

        {tab === "Animation" && (
          <AnimationPanel
            animations={animations}
            animState={animState}
            interval={interval}
            onIntervalChange={onIntervalChange}
            selectedIps={selectedIps}
            onPlay={onPlayAnim}
            onStop={onStopAnim}
            onDelete={onDeleteAnim}
            onSaveAnim={onSaveAnim}
          />
        )}

        {tab === "Scheduler" && (
          <SchedulerPanel
            roomId={roomId}
            selections={selections}
            devices={devices}
            embedded
          />
        )}
      </div>
    </div>
  );
}
