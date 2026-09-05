import React from "react";

interface KeycapProps {
  label: string;
  size?: "sm" | "md";
  special?: boolean;
  style?: React.CSSProperties;
}

export default function Keycap({ label, size = "md", special = false, style }: KeycapProps) {
  const isSm = size === "sm";

  // Map symbols for cleaner presentation
  const displayLabel = (() => {
    switch (label.toLowerCase()) {
      case "arrowup":
      case "up":
        return "▲";
      case "arrowdown":
      case "down":
        return "▼";
      case "arrowleft":
      case "left":
        return "◀";
      case "arrowright":
      case "right":
        return "▶";
      case "enter":
        return "↵";
      case "space":
        return "␣";
      default:
        return label.toUpperCase();
    }
  })();

  return (
    <span
      className={`arcade-keycap ${isSm ? "arcade-keycap-sm" : ""} ${special ? "arcade-keycap-special" : ""}`}
      style={style}
    >
      {displayLabel}
    </span>
  );
}
