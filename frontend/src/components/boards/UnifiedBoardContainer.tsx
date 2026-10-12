import React, { useState, useEffect, useMemo } from "react";
import { EquationSolution, VideoScene, ThemeType } from "../../types";
import { BOARD_THEMES } from "./themePalette";
import FunctionGraphBoard from "./FunctionGraphBoard";
import GeometryBoard from "./GeometryBoard";
import CalculusBoard from "./CalculusBoard";
import TrigBoard from "./TrigBoard";
import StatisticsBoard from "./StatisticsBoard";
import DualEquationBoard from "./DualEquationBoard";
import KineticMatrix from "../ui/kinetic-matrix";
import {
  TrendingUp,
  Compass,
  Activity,
  CircleDot,
  BarChart3,
  Layers,
  Scale,
  Maximize2,
  Minimize2,
  Sparkles,
  ChevronRight
} from "lucide-react";

export type BoardCategory =
  | "function"
  | "geometry"
  | "calculus"
  | "trigonometry"
  | "matrix"
  | "statistics"
  | "equation";

interface UnifiedBoardContainerProps {
  solution: EquationSolution | null;
  currentScene?: VideoScene;
  equationInput: string;
  theme: ThemeType;
  extractedMatrix?: { matrix: number[][] } | null;
  onSolve: (expr: string) => void;
  onEquationChange?: (expr: string) => void;
}

export default function UnifiedBoardContainer({
  solution,
  currentScene,
  equationInput,
  theme,
  extractedMatrix,
  onSolve,
  onEquationChange
}: UnifiedBoardContainerProps) {
  // Automatically identify the most appropriate board category
  const autoCategory = useMemo<BoardCategory>(() => {
    const raw = (solution?.equation || equationInput || "").trim().toLowerCase();
    const eqType = (solution?.equationType || "").toLowerCase();

    // 1. Matrix & Linear Algebra
    if (
      eqType.includes("linear algebra") ||
      eqType.includes("matrix") ||
      raw.includes("[[") ||
      raw.includes("det(") ||
      raw.includes("eigen(") ||
      raw.includes("inv(") ||
      raw.includes("cramer")
    ) {
      return "matrix";
    }

    // 2. Geometry
    if (
      eqType.includes("geometry") ||
      raw.startsWith("distance") ||
      raw.startsWith("dist(") ||
      raw.startsWith("midpoint") ||
      raw.startsWith("mid(") ||
      raw.startsWith("pythagor") ||
      raw.startsWith("circle(") ||
      raw.startsWith("triangle(") ||
      raw.startsWith("rectangle(") ||
      raw.startsWith("square(") ||
      raw.startsWith("rotate") ||
      raw.startsWith("translate") ||
      raw.startsWith("slope(")
    ) {
      return "geometry";
    }

    // 3. Calculus
    if (
      eqType.includes("calculus") ||
      raw.startsWith("integrate") ||
      raw.startsWith("derive") ||
      raw.includes("∫")
    ) {
      return "calculus";
    }

    // 4. Trigonometry
    if (
      eqType.includes("trigonometry") ||
      raw.includes("unit_circle") ||
      raw.startsWith("sin") ||
      raw.startsWith("cos") ||
      raw.startsWith("tan") ||
      raw.includes("sin(") ||
      raw.includes("cos(") ||
      raw.includes("tan(")
    ) {
      return "trigonometry";
    }

    // 5. Statistics
    if (
      eqType.includes("statistics") ||
      raw.startsWith("mean") ||
      raw.startsWith("median") ||
      raw.startsWith("mode") ||
      raw.startsWith("variance") ||
      raw.startsWith("stddev") ||
      raw.startsWith("std_dev") ||
      raw.startsWith("iqr") ||
      raw.startsWith("z_score") ||
      raw.startsWith("zscore") ||
      raw.startsWith("summary") ||
      raw.startsWith("stats") ||
      raw.startsWith("describe") ||
      raw.startsWith("regression") ||
      raw.startsWith("linreg") ||
      raw.startsWith("correlation") ||
      raw.startsWith("normal") ||
      raw.startsWith("t_test") ||
      raw.startsWith("ttest") ||
      raw.startsWith("binomial") ||
      raw.startsWith("poisson")
    ) {
      return "statistics";
    }

    // 6. Dual Plot Equation Balance (e.g. 2x + 5 = 15)
    if (raw.includes("=") && !raw.includes("unit_circle")) {
      return "equation";
    }

    // 7. Default: Visual Function Graph (e.g. x^2 - 5x + 6, polynomial, curves)
    return "function";
  }, [solution?.equation, solution?.equationType, equationInput]);

  // Current selected board category (defaults to autoCategory)
  const [activeBoard, setActiveBoard] = useState<BoardCategory>(autoCategory);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // When autoCategory changes due to a new equation, sync active board
  useEffect(() => {
    setActiveBoard(autoCategory);
  }, [autoCategory]);

  const activeColors = BOARD_THEMES[theme] || BOARD_THEMES.chalkboard;

  // Tab definitions
  const BOARD_TABS = [
    { id: "function" as BoardCategory, label: "Function Graph", icon: TrendingUp },
    { id: "geometry" as BoardCategory, label: "Geometry", icon: Compass },
    { id: "calculus" as BoardCategory, label: "Calculus", icon: Activity },
    { id: "trigonometry" as BoardCategory, label: "Unit Circle", icon: CircleDot },
    { id: "matrix" as BoardCategory, label: "Matrix Lab", icon: Layers },
    { id: "statistics" as BoardCategory, label: "Statistics", icon: BarChart3 },
    { id: "equation" as BoardCategory, label: "Dual Plot", icon: Scale }
  ];

  const currentTabInfo = BOARD_TABS.find((t) => t.id === activeBoard) || BOARD_TABS[0];
  const IconComponent = currentTabInfo.icon;

  // Render the selected board component
  const renderBoardContent = () => {
    switch (activeBoard) {
      case "function":
        return (
          <FunctionGraphBoard
            graphData={currentScene?.graphData || { showGraph: true, functionExpr: solution?.equation || equationInput }}
            annotations={currentScene?.annotations}
            theme={theme}
            customExpr={currentScene?.graphData?.functionExpr || solution?.equation || equationInput}
            onSolveExpr={onSolve}
          />
        );

      case "geometry":
        return (
          <GeometryBoard
            equationStr={solution?.equation || equationInput}
            annotations={currentScene?.annotations}
            theme={theme}
            onSolve={onSolve}
          />
        );

      case "calculus":
        return (
          <CalculusBoard
            equationStr={solution?.equation || equationInput}
            graphData={currentScene?.graphData}
            theme={theme}
          />
        );

      case "trigonometry":
        return (
          <TrigBoard
            equationStr={solution?.equation || equationInput}
            theme={theme}
          />
        );

      case "matrix":
        return (
          <KineticMatrix
            title="Interactive Matrix Inspector"
            theme={theme}
            className="w-full"
            initialMatrix={extractedMatrix?.matrix}
            matrixExpr={equationInput}
            onMatrixExprChange={onEquationChange}
            onSolve={(expr) => {
              if (onEquationChange) onEquationChange(expr);
              onSolve(expr);
            }}
          />
        );

      case "statistics":
        return (
          <StatisticsBoard
            equationStr={solution?.equation || equationInput}
            theme={theme}
          />
        );

      case "equation":
        return (
          <DualEquationBoard
            equationStr={solution?.equation || equationInput}
            theme={theme}
          />
        );

      default:
        return (
          <FunctionGraphBoard
            graphData={currentScene?.graphData || { showGraph: true }}
            theme={theme}
          />
        );
    }
  };

  return (
    <div className={`flex flex-col space-y-2 w-full ${isFullscreen ? "fixed inset-4 z-50 shadow-2xl" : ""}`}>
      {/* Board Selector Navigation & Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 font-scholar-title"
              style={{ color: activeColors.text }}
            >
              <IconComponent className="w-3.5 h-3.5" style={{ color: activeColors.curve }} />
              {currentTabInfo.label} Board
            </span>

            {/* Smart Auto-Selection Badge */}
            {activeBoard === autoCategory && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1"
                style={{
                  backgroundColor: `${activeColors.curve}22`,
                  color: activeColors.curve,
                  border: `1px solid ${activeColors.curve}44`
                }}
                title="Automatically selected based on current mathematical problem"
              >
                <Sparkles className="w-2.5 h-2.5" />
                Auto-Selected
              </span>
            )}
          </div>
        </div>

        {/* Board Switcher Pills Bar */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none max-w-full">
          {BOARD_TABS.map((tab) => {
            const isCurrent = activeBoard === tab.id;
            const isAuto = autoCategory === tab.id;
            const TabIcon = tab.icon;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveBoard(tab.id)}
                className={`text-[10px] px-2 py-1 rounded-lg border font-mono transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                  isCurrent
                    ? "font-bold shadow-xs"
                    : "opacity-60 hover:opacity-100 hover:bg-white/5"
                }`}
                style={{
                  backgroundColor: isCurrent ? activeColors.cardBg : "transparent",
                  color: isCurrent ? activeColors.curve : activeColors.text,
                  borderColor: isCurrent ? activeColors.cardBorder : "rgba(255, 255, 255, 0.08)"
                }}
                title={isAuto ? `${tab.label} (Recommended for current question)` : tab.label}
              >
                <TabIcon className="w-2.5 h-2.5" />
                <span>{tab.label}</span>
                {isAuto && !isCurrent && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-0.5" />
                )}
              </button>
            );
          })}

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition cursor-pointer border border-white/10 ml-1"
            title={isFullscreen ? "Exit Fullscreen" : "Maximize Board"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Main Board Visualizer Display */}
      <div className="relative overflow-hidden rounded-2xl flex-1 min-h-[360px] shadow-lg">
        {renderBoardContent()}
      </div>
    </div>
  );
}
