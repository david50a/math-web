/**
 * Speech Recognition and Math Translation Utilities
 */

// Normalizes spoken math phrases into valid algebraic/formula expressions
export function parseSpokenMath(rawText: string): string {
  let text = rawText.toLowerCase().trim();

  // Remove common verbal preambles
  text = text
    .replace(/^(please\s+)?(solve|calculate|evaluate|find|graph|differentiate|integrate|compute)\s+/i, "")
    .replace(/^(what is|how do i solve|can you solve)\s+/i, "");

  // Word-to-number substitutions for single digits
  const numberWords: Record<string, string> = {
    zero: "0",
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
    ten: "10",
  };

  // Replace isolated number words
  Object.entries(numberWords).forEach(([word, digit]) => {
    const reg = new RegExp(`\\b${word}\\b`, "gi");
    text = text.replace(reg, digit);
  });

  // Power & Exponent patterns
  text = text
    .replace(/\b(x|y|z|t)\s+squared\b/gi, "$1^2")
    .replace(/\b(x|y|z|t)\s+cubed\b/gi, "$1^3")
    .replace(/squared\b/gi, "^2")
    .replace(/cubed\b/gi, "^3")
    .replace(/\bto the power of\s+(\d+|[a-z]+)\b/gi, "^$1")
    .replace(/\bto the\s+(\d+)(st|nd|rd|th)?\s+power\b/gi, "^$1")
    .replace(/\braised to\s+(\d+|[a-z]+)\b/gi, "^$1");

  // Roots
  text = text
    .replace(/\bsquare root of\s+([a-z0-9()+\-*/^]+)/gi, "sqrt($1)")
    .replace(/\bcube root of\s+([a-z0-9()+\-*/^]+)/gi, "cbrt($1)")
    .replace(/\broot of\s+([a-z0-9()+\-*/^]+)/gi, "sqrt($1)");

  // Calculus & Advanced Operations
  text = text
    .replace(/\b(derivative of|differentiate|derive)\s+([a-z0-9()+\-*/^]+)/gi, "derive($2)")
    .replace(/\b(integral of|integrate)\s+([a-z0-9()+\-*/^]+)\s+with respect to\s+([a-z])/gi, "integrate($2, $3)")
    .replace(/\b(integral of|integrate)\s+([a-z0-9()+\-*/^]+)/gi, "integrate($2)")
    .replace(/\blimit of\s+([a-z0-9()+\-*/^]+)\s+as\s+([a-z])\s+approaches\s+(\d+|infinity|zero)/gi, "limit($1, $2, $3)");

  // Trigonometry
  text = text
    .replace(/\bsine of\s+/gi, "sin(")
    .replace(/\bsin of\s+/gi, "sin(")
    .replace(/\bcosine of\s+/gi, "cos(")
    .replace(/\bcos of\s+/gi, "cos(")
    .replace(/\btangent of\s+/gi, "tan(")
    .replace(/\btan of\s+/gi, "tan(")
    .replace(/\bsecant of\s+/gi, "sec(")
    .replace(/\bcosecant of\s+/gi, "csc(")
    .replace(/\bcotangent of\s+/gi, "cot(")
    .replace(/\barcsine of\s+/gi, "asin(")
    .replace(/\barccosine of\s+/gi, "acos(")
    .replace(/\barctangent of\s+/gi, "atan(");

  // Common Constants & Symbols
  text = text
    .replace(/\bpi\b/gi, "pi")
    .replace(/\btheta\b/gi, "theta")
    .replace(/\binfinity\b/gi, "oo")
    .replace(/\be to the\s+([a-z0-9()+\-*/^]+)/gi, "e^($1)");

  // Arithmetic operations
  text = text
    .replace(/\s+plus\s+/gi, " + ")
    .replace(/\s+minus\s+/gi, " - ")
    .replace(/\s+negative\s+(\w+)/gi, " -$1")
    .replace(/\s+times\s+/gi, " * ")
    .replace(/\s+multiplied by\s+/gi, " * ")
    .replace(/\s+divided by\s+/gi, " / ")
    .replace(/\s+over\s+/gi, " / ")
    .replace(/\s+equals\s+/gi, " = ")
    .replace(/\s+equal to\s+/gi, " = ")
    .replace(/\s+is equal to\s+/gi, " = ");

  // Spoken juxtaposition like "2 x" -> "2x", "5 y" -> "5y"
  text = text.replace(/(\d+)\s+([a-z])/gi, "$1$2");

  // Fix open brackets for trig if not closed
  const openCount = (text.match(/\(/g) || []).length;
  const closeCount = (text.match(/\)/g) || []).length;
  if (openCount > closeCount) {
    text += ")".repeat(openCount - closeCount);
  }

  return text.trim();
}

// Converts LaTeX and mathematical strings to clean, human-pronounceable English for TTS
export function cleanLatexForSpeech(latex: string): string {
  if (!latex) return "";

  let speech = latex
    // Remove markdown symbols
    .replace(/[*_`#]/g, "")
    // LaTeX math macros
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1 over $2")
    .replace(/\\sqrt\[(\d+)\]\{([^}]+)\}/g, "the $1th root of $2")
    .replace(/\\sqrt\{([^}]+)\}/g, "square root of $1")
    .replace(/\\sin\^\{-1\}/g, "arc sine")
    .replace(/\\cos\^\{-1\}/g, "arc cosine")
    .replace(/\\tan\^\{-1\}/g, "arc tangent")
    .replace(/\\sin/g, "sine")
    .replace(/\\cos/g, "cosine")
    .replace(/\\tan/g, "tangent")
    .replace(/\\sec/g, "secant")
    .replace(/\\csc/g, "cosecant")
    .replace(/\\cot/g, "cotangent")
    .replace(/\\ln/g, "natural log of")
    .replace(/\\log/g, "log")
    .replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, "integral from $1 to $2 of")
    .replace(/\\int/g, "integral of")
    .replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, "sum from $1 to $2 of")
    .replace(/\\lim_\{([^}]+)\}/g, "limit as $1 of")
    .replace(/\\to/g, "approaches")
    .replace(/\\infty/g, "infinity")
    .replace(/\\pm/g, "plus or minus")
    .replace(/\\mp/g, "minus or plus")
    .replace(/\\times/g, "times")
    .replace(/\\div/g, "divided by")
    .replace(/\\cdot/g, "times")
    .replace(/\\pi/g, "pi")
    .replace(/\\theta/g, "theta")
    .replace(/\\alpha/g, "alpha")
    .replace(/\\beta/g, "beta")
    .replace(/\\gamma/g, "gamma")
    .replace(/\\delta/g, "delta")
    .replace(/\\lambda/g, "lambda")
    .replace(/\\sigma/g, "sigma")
    .replace(/\\leq/g, "is less than or equal to")
    .replace(/\\geq/g, "is greater than or equal to")
    .replace(/\\neq/g, "is not equal to")
    .replace(/\\approx/g, "is approximately")
    .replace(/\\left\(/g, "(")
    .replace(/\\right\)/g, ")")
    .replace(/\\left\[/g, "[")
    .replace(/\\right\]/g, "]")
    .replace(/\\left\{/g, "{")
    .replace(/\\right\}/g, "}")
    .replace(/\\cdot/g, " ")
    .replace(/\\,/g, " ")
    .replace(/\\;/g, " ")
    .replace(/\\quad/g, " ")
    .replace(/\\qquad/g, " ")
    .replace(/\\text\{([^}]+)\}/g, "$1")
    .replace(/\^2/g, " squared ")
    .replace(/\^3/g, " cubed ")
    .replace(/\^\{([^}]+)\}/g, " to the power of $1 ")
    .replace(/\^([0-9a-zA-Z])/g, " to the power of $1 ")
    .replace(/_\{([^}]+)\}/g, " sub $1 ")
    .replace(/_([0-9a-zA-Z])/g, " sub $1 ")
    // Remove stray LaTeX backslashes
    .replace(/\\([a-zA-Z]+)/g, "$1")
    .replace(/[{}]/g, " ")
    .replace(/\s{2,}/g, " ");

  return speech.trim();
}

// Browser Web Speech Recognition API instance helper
export function createSpeechRecognition(): any {
  if (typeof window === "undefined") return null;

  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  return recognition;
}

// Play speech synthesis with clean voice
export function speakCleanText(
  text: string,
  options?: {
    rate?: number;
    pitch?: number;
    volume?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  }
): SpeechSynthesisUtterance | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;

  try {
    window.speechSynthesis.cancel();

    const cleanSpeech = cleanLatexForSpeech(text);
    if (!cleanSpeech) return null;

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.rate = options?.rate ?? 1.0;
    utterance.pitch = options?.pitch ?? 1.0;
    utterance.volume = options?.volume ?? 1.0;

    const voices = window.speechSynthesis.getVoices();
    // Prioritize natural English voices
    const preferredVoice =
      voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Natural") ||
            v.name.includes("Google") ||
            v.name.includes("Samantha") ||
            v.name.includes("Daniel") ||
            v.name.includes("Karen"))
      ) || voices.find((v) => v.lang.startsWith("en"));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    if (options?.onStart) utterance.onstart = options.onStart;
    if (options?.onEnd) utterance.onend = options.onEnd;
    if (options?.onError) utterance.onerror = options.onError;

    window.speechSynthesis.speak(utterance);
    return utterance;
  } catch (err) {
    console.warn("Speech synthesis error:", err);
    options?.onError?.(err);
    return null;
  }
}

// Cancel all speech
export function cancelSpeech(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
