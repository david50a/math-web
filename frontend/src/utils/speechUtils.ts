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
    // Remove markdown formatting, bold, italics, code ticks, URLs
    .replace(/[*_`#~]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    // Remove emojis for natural speech
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    
    // Matrix and determinant environments
    .replace(/\\det\\begin\{(?:pmatrix|bmatrix|matrix)\}([\s\S]*?)\\end\{(?:pmatrix|bmatrix|matrix)\}/gi, "determinant of the matrix, ")
    .replace(/\\begin\{(?:pmatrix|bmatrix|matrix)\}([\s\S]*?)\\end\{(?:pmatrix|bmatrix|matrix)\}/gi, "the matrix, ")
    .replace(/det\(\[\[(.*?)\]\]\)/gi, "the determinant of the matrix, ")
    
    // Spoken equation logical connectors
    .replace(/\\implies/g, ", which implies that, ")
    .replace(/\\iff/g, ", if and only if, ")
    .replace(/\\forall/g, "for all ")
    .replace(/\\exists/g, "there exists ")
    .replace(/\\in/g, " in ")
    .replace(/\\mathbb\{C\}/g, "the complex numbers")
    .replace(/\\mathbb\{R\}/g, "the real numbers")
    .replace(/\\mathbb\{Z\}/g, "the integers")
    .replace(/\\mathbb\{N\}/g, "the natural numbers")

    // Calculus & Derivatives
    .replace(/\\frac\{d\}\{dx\}\s*\\left\[([^\]]+)\\right\]/g, "the derivative with respect to x of $1, ")
    .replace(/\\frac\{d\}\{dx\}\s*\(([^)]+)\)/g, "the derivative with respect to x of $1, ")
    .replace(/\\frac\{d\}\{dx\}/g, "the derivative with respect to x of ")
    .replace(/\\frac\{\\partial\}\{\\partial\s*([a-zA-Z])\}/g, "the partial derivative with respect to $1 of ")
    .replace(/\\frac\{d([a-zA-Z])\}\{d([a-zA-Z])\}/g, "d $1 by d $2")

    // Integrals & Limits
    .replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}\s*([^\\]+?)\s*d([a-zA-Z])/g, "the integral from $1 to $2 of $3 with respect to $4, ")
    .replace(/\\int\s*([^\\]+?)\s*d([a-zA-Z])/g, "the integral of $1 with respect to $2, ")
    .replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, "integral from $1 to $2 of ")
    .replace(/\\int/g, "integral of ")
    .replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, "sum from $1 to $2 of ")
    .replace(/\\lim_\{([a-zA-Z])\s*\\to\s*([^}]+)\}/g, "the limit as $1 approaches $2 of ")

    // Fractions: \frac{A}{B}
    .replace(/\\frac\{(-?[a-zA-Z0-9]+)\}\{([a-zA-Z0-9]+)\}/g, "$1 over $2")
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "quantity $1, divided by, $2")

    // Roots
    .replace(/\\sqrt\[(\d+)\]\{([^}]+)\}/g, "the $1th root of $2")
    .replace(/\\sqrt\{([^}]+)\}/g, "the square root of $1")

    // Trigonometry
    .replace(/\\sin\^\{-1\}/g, "arc sine")
    .replace(/\\cos\^\{-1\}/g, "arc cosine")
    .replace(/\\tan\^\{-1\}/g, "arc tangent")
    .replace(/\\sin\b/g, "sine")
    .replace(/\\cos\b/g, "cosine")
    .replace(/\\tan\b/g, "tangent")
    .replace(/\\sec\b/g, "secant")
    .replace(/\\csc\b/g, "cosecant")
    .replace(/\\cot\b/g, "cotangent")
    .replace(/\\ln\b/g, "natural log of ")
    .replace(/\\log\b/g, "log of ")

    // Symbols & Operations
    .replace(/\\to/g, " approaches ")
    .replace(/\\infty/g, "infinity")
    .replace(/\\pm/g, " plus or minus ")
    .replace(/\\mp/g, " minus or plus ")
    .replace(/\\times/g, " times ")
    .replace(/\\div/g, " divided by ")
    .replace(/\\cdot/g, " times ")
    .replace(/\\pi/g, "pi")
    .replace(/\\theta/g, "theta")
    .replace(/\\alpha/g, "alpha")
    .replace(/\\beta/g, "beta")
    .replace(/\\gamma/g, "gamma")
    .replace(/\\delta/g, "delta")
    .replace(/\\lambda/g, "lambda")
    .replace(/\\sigma/g, "sigma")
    .replace(/\\leq/g, " is less than or equal to ")
    .replace(/\\geq/g, " is greater than or equal to ")
    .replace(/\\neq/g, " does not equal ")
    .replace(/\\approx/g, " is approximately equal to ")

    // Powers & Indices
    .replace(/\^2\b/g, " squared")
    .replace(/\^3\b/g, " cubed")
    .replace(/\^\{([^}]+)\}/g, " to the power of $1")
    .replace(/\^([0-9a-zA-Z])/g, " to the power of $1")
    .replace(/_1\b/g, " one")
    .replace(/_2\b/g, " two")
    .replace(/_\{([^}]+)\}/g, " sub $1")
    .replace(/_([0-9a-zA-Z])/g, " sub $1")

    // Brackets and text
    .replace(/\\left\(/g, "(")
    .replace(/\\right\)/g, ")")
    .replace(/\\left\[/g, "[")
    .replace(/\\right\]/g, "]")
    .replace(/\\left\{/g, "{")
    .replace(/\\right\}/g, "}")
    .replace(/\\text\{([^}]+)\}/g, " $1 ")
    .replace(/\\quad/g, ", ")
    .replace(/\\qquad/g, ". ")
    .replace(/\\,/g, " ")
    .replace(/\\;/g, " ")
    .replace(/\\([a-zA-Z]+)/g, "$1")
    .replace(/[{}]/g, " ")
    .replace(/&/g, " and ")
    .replace(/=/g, " equals ")
    .replace(/\+/g, " plus ")
    .replace(/(?<=\d|\w)-(?=\d|\w)/g, " minus ")
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

export type VoicePersona = "natural" | "scholar" | "friendly" | "cyborg";

// Preload and cache speech synthesis voices immediately
let cachedVoices: SpeechSynthesisVoice[] = [];
if (typeof window !== "undefined" && window.speechSynthesis) {
  cachedVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

export function initSpeechVoices(): SpeechSynthesisVoice[] {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    const list = window.speechSynthesis.getVoices();
    if (list.length > 0) {
      cachedVoices = list;
    }
  }
  return cachedVoices;
}

// Selects the absolute highest quality human natural/neural voice available
export function getBestHumanVoice(options?: {
  persona?: VoicePersona;
  gender?: "male" | "female";
  preferredName?: string;
}): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;

  const voices = cachedVoices.length > 0 ? cachedVoices : window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const enVoices = voices.filter((v) => v.lang.startsWith("en"));
  const voicePool = enVoices.length > 0 ? enVoices : voices;

  // 1. If a specific voice was requested by name
  if (options?.preferredName) {
    const match = voicePool.find((v) => v.name.toLowerCase().includes(options.preferredName!.toLowerCase()));
    if (match) return match;
  }

  const persona = options?.persona || "natural";
  const preferFemale = options?.gender === "female" || persona === "scholar" || persona === "friendly";

  // Tier 1: Microsoft Edge / Windows 11 Natural Neural voices (Human studio quality)
  if (preferFemale) {
    const naturalFemale = voicePool.find(
      (v) =>
        (v.name.includes("Online (Natural)") || v.name.includes("Natural")) &&
        (v.name.includes("Jenny") ||
          v.name.includes("Aria") ||
          v.name.includes("Michelle") ||
          v.name.includes("Sonia") ||
          v.name.includes("Libby") ||
          v.name.includes("Clara"))
    );
    if (naturalFemale) return naturalFemale;
  } else {
    const naturalMale = voicePool.find(
      (v) =>
        (v.name.includes("Online (Natural)") || v.name.includes("Natural")) &&
        (v.name.includes("Guy") ||
          v.name.includes("Christopher") ||
          v.name.includes("Eric") ||
          v.name.includes("Roger") ||
          v.name.includes("Ryan") ||
          v.name.includes("Steffan") ||
          v.name.includes("Thomas"))
    );
    if (naturalMale) return naturalMale;
  }

  // Tier 2: Any Microsoft Natural voice
  const anyNatural = voicePool.find(
    (v) => v.name.includes("Online (Natural)") || v.name.includes("Natural")
  );
  if (anyNatural) return anyNatural;

  // Tier 3: Google Chrome Neural / High Quality voices
  if (preferFemale) {
    const googleFemale = voicePool.find(
      (v) => v.name.includes("Google UK English Female") || v.name.includes("Google US English")
    );
    if (googleFemale) return googleFemale;
  } else {
    const googleMale = voicePool.find(
      (v) => v.name.includes("Google UK English Male")
    );
    if (googleMale) return googleMale;
  }

  const googleEn = voicePool.find((v) => v.name.includes("Google"));
  if (googleEn) return googleEn;

  // Tier 4: Apple Premium / Enhanced Voices (macOS / iOS / Safari)
  if (preferFemale) {
    const appleFemale = voicePool.find(
      (v) =>
        v.name.includes("Samantha (Enhanced)") ||
        v.name.includes("Samantha") ||
        v.name.includes("Serena") ||
        v.name.includes("Karen")
    );
    if (appleFemale) return appleFemale;
  } else {
    const appleMale = voicePool.find(
      (v) =>
        v.name.includes("Daniel (Enhanced)") ||
        v.name.includes("Daniel") ||
        v.name.includes("Alex") ||
        v.name.includes("Oliver")
    );
    if (appleMale) return appleMale;
  }

  // Tier 5: Standard en-US voice
  const enUS = voicePool.find((v) => v.lang === "en-US" || v.lang === "en_US");
  if (enUS) return enUS;

  // Fallback to first English voice
  return voicePool[0] || null;
}

export function isNeuralVoice(voice: SpeechSynthesisVoice | null): boolean {
  if (!voice) return false;
  const n = voice.name.toLowerCase();
  return n.includes("natural") || n.includes("neural") || n.includes("google") || n.includes("enhanced");
}

export function getVoiceDisplayName(voice: SpeechSynthesisVoice | null): string {
  if (!voice) return "Natural Voice";
  const isNeural = isNeuralVoice(voice);
  const clean = voice.name
    .replace(/^Microsoft\s+/, "")
    .replace(/\s+Online\s+\(Natural\)/i, "")
    .replace(/\s+\(Enhanced\)/i, "")
    .replace(/\s+Desktop/i, "")
    .replace(/\s+-\s+English\s*\([^)]*\)/i, "");
  return `${clean} ${isNeural ? "• Neural Human" : "• Voice"}`;
}

// Play speech synthesis with human-like voice selection and natural cadence
export function speakCleanText(
  text: string,
  options?: {
    rate?: number;
    pitch?: number;
    volume?: number;
    persona?: VoicePersona;
    gender?: "male" | "female";
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
    
    // Human-like conversational rate and pitch
    utterance.rate = options?.rate ?? 0.98;
    utterance.pitch = options?.pitch ?? 1.0;
    utterance.volume = options?.volume ?? 1.0;

    const bestVoice = getBestHumanVoice({
      persona: options?.persona,
      gender: options?.gender,
    });

    if (bestVoice) {
      utterance.voice = bestVoice;
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

