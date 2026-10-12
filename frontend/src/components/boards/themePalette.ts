import { ThemeType } from "../../types";

export interface BoardThemeColors {
  bg: string;
  grid: string;
  gridBold: string;
  axis: string;
  text: string;
  textMuted: string;
  curve: string;
  secondaryCurve: string;
  point: string;
  accent: string;
  cardBg: string;
  cardBorder: string;
}

export const BOARD_THEMES: Record<ThemeType, BoardThemeColors> = {
  chalkboard: {
    bg: "#0c1813",
    grid: "rgba(255, 255, 255, 0.06)",
    gridBold: "rgba(255, 255, 255, 0.14)",
    axis: "rgba(255, 255, 240, 0.75)",
    text: "#fde047",
    textMuted: "rgba(253, 224, 71, 0.6)",
    curve: "#4ade80",
    secondaryCurve: "#facc15",
    point: "#fb7185",
    accent: "#38bdf8",
    cardBg: "rgba(14, 26, 20, 0.9)",
    cardBorder: "rgba(245, 158, 11, 0.2)"
  },
  blueprint: {
    bg: "#041429",
    grid: "rgba(56, 189, 248, 0.12)",
    gridBold: "rgba(56, 189, 248, 0.28)",
    axis: "rgba(125, 211, 252, 0.85)",
    text: "#7dd3fc",
    textMuted: "rgba(125, 211, 252, 0.6)",
    curve: "#00f0ff",
    secondaryCurve: "#fbbf24",
    point: "#f43f5e",
    accent: "#38bdf8",
    cardBg: "rgba(6, 26, 52, 0.9)",
    cardBorder: "rgba(56, 189, 248, 0.25)"
  },
  cosmos: {
    bg: "#060314",
    grid: "rgba(168, 85, 247, 0.12)",
    gridBold: "rgba(168, 85, 247, 0.28)",
    axis: "rgba(251, 191, 36, 0.7)",
    text: "#e9d5ff",
    textMuted: "rgba(233, 213, 255, 0.6)",
    curve: "#c084fc",
    secondaryCurve: "#2dd4bf",
    point: "#fbbf24",
    accent: "#a855f7",
    cardBg: "rgba(19, 10, 40, 0.9)",
    cardBorder: "rgba(168, 85, 247, 0.25)"
  },
  lightAcademic: {
    bg: "#FFFFFF",
    grid: "rgba(226, 232, 240, 0.85)",
    gridBold: "rgba(203, 213, 225, 0.95)",
    axis: "rgba(71, 85, 105, 0.85)",
    text: "#0F172A",
    textMuted: "rgba(71, 85, 105, 0.7)",
    curve: "#2563EB",
    secondaryCurve: "#7C3AED",
    point: "#DC2626",
    accent: "#0D9488",
    cardBg: "rgba(248, 250, 252, 0.95)",
    cardBorder: "rgba(226, 232, 240, 1)"
  },
  darkAI: {
    bg: "#0B1020",
    grid: "rgba(59, 130, 246, 0.08)",
    gridBold: "rgba(59, 130, 246, 0.22)",
    axis: "rgba(96, 165, 250, 0.7)",
    text: "#93c5fd",
    textMuted: "rgba(147, 197, 253, 0.6)",
    curve: "#38bdf8",
    secondaryCurve: "#a855f7",
    point: "#f43f5e",
    accent: "#06b6d4",
    cardBg: "rgba(17, 24, 39, 0.9)",
    cardBorder: "rgba(39, 52, 73, 0.6)"
  },
  notebook: {
    bg: "#FFFDF8",
    grid: "rgba(217, 206, 187, 0.6)",
    gridBold: "rgba(196, 181, 159, 0.8)",
    axis: "rgba(120, 113, 108, 0.8)",
    text: "#292524",
    textMuted: "rgba(87, 83, 78, 0.7)",
    curve: "#1d4ed8",
    secondaryCurve: "#b45309",
    point: "#b91c1c",
    accent: "#047857",
    cardBg: "rgba(254, 252, 246, 0.95)",
    cardBorder: "rgba(226, 218, 199, 1)"
  },
  glassmorphic: {
    bg: "#0d1117",
    grid: "rgba(255, 255, 255, 0.06)",
    gridBold: "rgba(255, 255, 255, 0.16)",
    axis: "rgba(255, 255, 255, 0.7)",
    text: "#f3f4f6",
    textMuted: "rgba(243, 244, 246, 0.6)",
    curve: "#60a5fa",
    secondaryCurve: "#f472b6",
    point: "#fbbf24",
    accent: "#34d399",
    cardBg: "rgba(255, 255, 255, 0.05)",
    cardBorder: "rgba(255, 255, 255, 0.12)"
  },
  darkroom: {
    bg: "#100606",
    grid: "rgba(239, 68, 68, 0.08)",
    gridBold: "rgba(239, 68, 68, 0.2)",
    axis: "rgba(248, 113, 113, 0.7)",
    text: "#fca5a5",
    textMuted: "rgba(252, 165, 165, 0.6)",
    curve: "#ef4444",
    secondaryCurve: "#f97316",
    point: "#fbbf24",
    accent: "#e11d48",
    cardBg: "rgba(24, 8, 8, 0.9)",
    cardBorder: "rgba(239, 68, 68, 0.25)"
  },
  cyberpunk: {
    bg: "#120b1f",
    grid: "rgba(234, 179, 8, 0.1)",
    gridBold: "rgba(234, 179, 8, 0.22)",
    axis: "rgba(6, 182, 212, 0.7)",
    text: "#facc15",
    textMuted: "rgba(250, 204, 21, 0.6)",
    curve: "#facc15",
    secondaryCurve: "#06b6d4",
    point: "#ec4899",
    accent: "#a855f7",
    cardBg: "rgba(26, 15, 46, 0.9)",
    cardBorder: "rgba(234, 179, 8, 0.25)"
  },
  sunset: {
    bg: "#241009",
    grid: "rgba(245, 158, 11, 0.1)",
    gridBold: "rgba(245, 158, 11, 0.22)",
    axis: "rgba(251, 146, 60, 0.7)",
    text: "#fef3c7",
    textMuted: "rgba(254, 243, 199, 0.6)",
    curve: "#f59e0b",
    secondaryCurve: "#ea580c",
    point: "#fbbf24",
    accent: "#fb923c",
    cardBg: "rgba(45, 20, 11, 0.9)",
    cardBorder: "rgba(245, 158, 11, 0.25)"
  },
  synthwave: {
    bg: "#190729",
    grid: "rgba(236, 72, 153, 0.12)",
    gridBold: "rgba(236, 72, 153, 0.25)",
    axis: "rgba(168, 85, 247, 0.7)",
    text: "#fbcfe8",
    textMuted: "rgba(251, 207, 232, 0.6)",
    curve: "#ec4899",
    secondaryCurve: "#8b5cf6",
    point: "#06b6d4",
    accent: "#f43f5e",
    cardBg: "rgba(35, 10, 58, 0.9)",
    cardBorder: "rgba(236, 72, 153, 0.25)"
  },
  nordic: {
    bg: "#0f1722",
    grid: "rgba(148, 163, 184, 0.08)",
    gridBold: "rgba(148, 163, 184, 0.18)",
    axis: "rgba(186, 230, 253, 0.6)",
    text: "#e2e8f0",
    textMuted: "rgba(226, 232, 240, 0.6)",
    curve: "#38bdf8",
    secondaryCurve: "#94a3b8",
    point: "#f43f5e",
    accent: "#0ea5e9",
    cardBg: "rgba(21, 32, 48, 0.9)",
    cardBorder: "rgba(148, 163, 184, 0.2)"
  },
  matrix: {
    bg: "#051208",
    grid: "rgba(34, 197, 94, 0.1)",
    gridBold: "rgba(34, 197, 94, 0.22)",
    axis: "rgba(74, 222, 128, 0.7)",
    text: "#86efac",
    textMuted: "rgba(134, 239, 172, 0.6)",
    curve: "#22c55e",
    secondaryCurve: "#eab308",
    point: "#4ade80",
    accent: "#10b981",
    cardBg: "rgba(7, 26, 12, 0.9)",
    cardBorder: "rgba(34, 197, 94, 0.25)"
  },
  royal: {
    bg: "#1c0b18",
    grid: "rgba(245, 158, 11, 0.1)",
    gridBold: "rgba(245, 158, 11, 0.22)",
    axis: "rgba(251, 191, 36, 0.7)",
    text: "#fde68a",
    textMuted: "rgba(253, 230, 138, 0.6)",
    curve: "#f59e0b",
    secondaryCurve: "#f43f5e",
    point: "#fbbf24",
    accent: "#e11d48",
    cardBg: "rgba(38, 15, 33, 0.9)",
    cardBorder: "rgba(245, 158, 11, 0.25)"
  }
};
