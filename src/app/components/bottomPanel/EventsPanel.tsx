import { Plus, Zap } from "lucide-react";

const EVENTS = [
  { widget: "Button1", event: "CLICKED", action: "Screen_LoadScreen(Screen2)" },
  { widget: "Slider1", event: "VALUE_CHANGED", action: "SetTemperature(value)" },
];

export function EventsPanel() {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-neutral-100">Event Handlers</div>
        <button className="px-3 py-1 bg-highlight-500 hover:bg-highlight-400 rounded text-xs flex items-center gap-1 transition-colors text-white">
          <Plus size={12} />
          Add Event
        </button>
      </div>
      <div className="space-y-2">
        {EVENTS.map((event) => (
          <div key={`${event.widget}-${event.event}`} className="p-3 bg-neutral-800 rounded border border-neutral-600">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-neutral-100">{event.widget}</div>
              <div className="p-1 bg-neutral-700 rounded">
                <Zap size={14} className="text-warning-500" />
              </div>
            </div>
            <div className="text-xs text-neutral-300">Event: {event.event}</div>
            <div className="text-xs text-neutral-300">Action: {event.action}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
