import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import http from "http";
import { spawn } from "child_process";
import net from "net";
import Tesseract from "tesseract.js";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "../backend/.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Initialize Gemini safely at startup
let ai: GoogleGenAI | null = null;
const apiKey = process.env.GEMINI_API_KEY;

if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const app = express();
const PORT = 3001;

// Proxy requests to the Python FastAPI backend on port 4000
const backendProxy = (req: express.Request, res: express.Response) => {
  const options = {
    hostname: "127.0.0.1",
    port: 4000,
    path: req.originalUrl,
    method: req.method,
    headers: req.headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  req.pipe(proxyReq, { end: true });

  proxyReq.on("error", (err) => {
    console.error("Backend Proxy error:", err);
    if (!res.headersSent) {
      res.status(502).json({
        error: "Backend service unreachable",
        message: "Make sure the Python backend is running on port 4000"
      });
    }
  });
};

// Math OCR endpoint needs to be registered BEFORE the catch-all /api proxy.
// We apply express.json() only to this endpoint to prevent consuming the stream for proxy requests.
app.post('/api/ocr', express.json({ limit: "10mb" }), async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "No image provided." });
    }

    if (ai) {
      console.log("Starting Multimodal Math, Geometry & Trig OCR with Gemini...");
      try {
        const match = imageBase64.match(/^data:(image\/\w+);base64,/);
        const mimeType = match ? match[1] : "image/jpeg";
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `You are an expert mathematical, geometric, and trigonometric OCR and visual reasoning engine. You recognize handwritten, printed, and textbook equations, diagrams, figures, and word problems.

Analyze this image and extract or formulate the exact mathematical query needed to solve the problem in our Axiom Engine.

OUTPUT RULES:
- Return ONLY the final plain text math string or function call without markdown formatting, backticks, or conversational text.
- Do NOT wrap in quotes or code blocks.

FORMATTING SPECIFICATIONS:

1. GEOMETRY DIAGRAMS & PROBLEMS:
- Right Triangles (Pythagorean): If a right triangle is shown with two legs known, format as: pythagorean(a, b) (e.g. pythagorean(3, 4)). If one leg 'a' and hypotenuse 'c' are known, format as: pythagorean(a, c) or triangle(a, b, c).
- General Triangles: If a triangle is shown with sides or SSS/SAS given, format as: triangle(a, b, c) (e.g. triangle(5, 7, 8) or triangle(3, 4, 5)).
- Circles: If a circle diagram with radius r is shown, format as: circle(r) (e.g. circle(5)).
- Rectangles / Squares: format as: rectangle(w, h) (e.g. rectangle(6, 4)) or square(s) (e.g. square(5)).
- Coordinate Geometry:
  * Distance between points: distance([x1, y1], [x2, y2])
  * Midpoint: midpoint([x1, y1], [x2, y2])
  * Slope: slope([x1, y1], [x2, y2])
  * Line equation: line([x1, y1], [x2, y2])
- 3D Solids: sphere(r), cylinder(r, h), cone(r, h).
- Transformations: translate(shape, dx, dy), rotate(shape, angle), scale(shape, factor), reflect(shape, axis).

2. TRIGONOMETRY DIAGRAMS & EQUATIONS:
- Unit Circle: If an angle on the unit circle or unit circle figure is shown, format as: unit_circle(angle) (e.g. unit_circle(pi/3), unit_circle(45), unit_circle(pi/4)).
- Trig Equations: Format standard equations cleanly: sin(x) = 0.5, 2*sin(x) - 1 = 0, sin(2*x) = 1, sin(x) = cos(x), sin(x)^2 + cos(x)^2 = 1.
- Trig Expressions / Values: sin(pi/6), cos(45), tan(pi/4), arcsin(0.5).
- Trig Word Problems: Extract the core equation to solve (e.g. sin(x) = 0.5 or pythagorean(3, 4)).

3. MATRICES & LINEAR ALGEBRA:
- Format any matrix as nested arrays: [[row1_elements], [row2_elements]]. Example: [[1, 2], [3, 4]] or [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
- Determinants: If enclosed in vertical bars |A| or asking for det, return: det([[...]])
- Matrix Inverse: If asking for A^-1 or inverse, return: inv([[...]])
- Matrix Eigenvalues: If asking for eigenvalues or char poly, return: eigen([[...]])
- Operations: [[1, 2], [3, 4]] * [[5, 6], [7, 8]] or [[1, 2], [3, 4]] + [[5, 6], [7, 8]]

4. CALCULUS, ALGEBRA & STATISTICS:
- Integrals: integrate(expr) (e.g. integrate(x^2 - 5x + 6))
- Derivatives: derive(expr) (e.g. derive(sin(x)*cos(x)))
- Algebraic Equations: x^2 - 5x + 6 = 0, 3*x + 5 = 20
- Statistics: mean([10, 20, 30]), median([1, 4, 7, 9])

5. WORD PROBLEMS:
- Translate the question directly into its mathematical solver query (e.g. "Find the hypotenuse of a triangle with legs 3 and 4" -> pythagorean(3, 4)).`
                },
                { inlineData: { data: base64Data, mimeType: mimeType } }
              ]
            }
          ]
        });
        let equation = response.text?.trim() || "";
        // Strip markdown backticks, quotes, or language tags
        equation = equation.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
        equation = equation.replace(/^["']|["']$/g, '').trim();
        equation = normalizeMatrixInString(equation);
        console.log("Gemini Multimodal OCR result:", equation);
        return res.json({ equation });
      } catch (err: any) {
        console.error("Gemini OCR failed, falling back to Tesseract...", err);
      }
    }

    console.log("Starting local OCR with Tesseract...");

    // In Node.js, Tesseract.js expects a Buffer, file path, or URL. 
    // We must strip the Data URL prefix and convert it to a Buffer.
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const result = await Tesseract.recognize(
      imageBuffer,
      'eng',
      { logger: m => console.log(`[Tesseract] ${m.status}: ${Math.round(m.progress * 100)}%`) }
    );

    const rawText = result.data.text.trim();
    console.log("Raw Tesseract OCR multiline text:\n", rawText);

    // Check if the OCR text represents a 2D matrix or table of numbers
    const matrixParsed = parseMatrixFromTesseract(rawText);
    let equation = "";

    if (matrixParsed) {
      equation = matrixParsed;
      console.log("Reconstructed matrix from local OCR:", equation);
    } else {
      equation = cleanMathOcrText(rawText);
      // Normalize any LaTeX matrix structures if present
      equation = normalizeMatrixInString(equation);
    }

    console.log("Local OCR result:", equation);
    res.json({ equation });

  } catch (err: any) {
    console.error("OCR Error:", err);
    res.status(500).json({ error: "Failed to process image.", details: err.message });
  }
});

// Comprehensive mathematical symbol and OCR artifact normalization
function cleanMathOcrText(raw: string): string {
  if (!raw) return "";
  let s = raw.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').trim();

  // Normalize Unicode dashes and minuses
  s = s.replace(/[—–−ー]/g, '-');

  // Fix degree/superscript OCR artifacts for powers (e.g., 6x°-17x -> 6x^2 - 17x)
  s = s.replace(/([a-zA-Z0-9\)])[°º]/g, '$1^2');
  s = s.replace(/([a-zA-Z0-9\)])²/g, '$1^2');
  s = s.replace(/([a-zA-Z0-9\)])³/g, '$1^3');
  s = s.replace(/([a-zA-Z0-9\)])⁴/g, '$1^4');
  s = s.replace(/([a-zA-Z0-9\)])⁵/g, '$1^5');
  s = s.replace(/([a-zA-Z0-9\)])⁶/g, '$1^6');
  s = s.replace(/([a-zA-Z0-9\)])⁷/g, '$1^7');
  s = s.replace(/([a-zA-Z0-9\)])⁸/g, '$1^8');
  s = s.replace(/([a-zA-Z0-9\)])⁹/g, '$1^9');

  // Fix variable followed directly by power without caret (e.g. 6x2 - 17x -> 6x^2 - 17x)
  s = s.replace(/([a-zA-Z])\s*([2-9])(?=\s*[-+=*/]|$)/g, '$1^$2');

  // Normalize multiplication & division
  s = s.replace(/\\cdot|\\times|[×·]/g, '*');
  s = s.replace(/\\div|÷/g, '/');

  // Normalize roots
  s = s.replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)');
  s = s.replace(/√\(([^)]+)\)/g, 'sqrt($1)');
  s = s.replace(/√([a-zA-Z0-9]+)/g, 'sqrt($1)');

  // Normalize fractions: \frac{a}{b} -> (a)/(b)
  s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');

  // Normalize calculus operations
  s = s.replace(/\\int|∫/g, 'integrate');
  s = s.replace(/\\frac\{d\}\{dx\}\s*\(?(.*?)\)?/g, 'derive($1)');

  // Fix letter 'O' confused with digit 0 near equals sign
  s = s.replace(/=\s*[Oo]\b/g, '= 0');
  s = s.replace(/\b[Oo]\s*=/g, '0 =');

  // Normalize trigonometry OCR confusions
  s = s.replace(/\bs[1l|!]n\b/gi, 'sin');
  s = s.replace(/\bc[0oO]s\b/gi, 'cos');
  s = s.replace(/\bt[4a]n\b/gi, 'tan');
  s = s.replace(/\\(?:theta|vartheta)|[θ]/gi, 'x');
  s = s.replace(/\\(?:pi)|[π]/gi, 'pi');
  s = s.replace(/\\(?:alpha)|[α]/gi, 'a');
  s = s.replace(/\\(?:beta)|[β]/gi, 'b');

  // Clean spacing around operators for neat expression
  s = s.replace(/([0-9a-zA-Z\)])\s*([+\-=])\s*([0-9a-zA-Z\(])/g, '$1 $2 $3');

  return s.trim();
}

// Helper function to normalize LaTeX and math matrix representations into standard engine syntax
function normalizeMatrixInString(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();

  // Strip markdown code block wrappers if any
  s = s.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();

  // Convert LaTeX matrix environments like \begin{pmatrix} a & b \\ c & d \end{pmatrix}
  s = s.replace(/\\(?:det\s*)?\\begin\{(pmatrix|bmatrix|matrix|Bmatrix)\}([\s\S]*?)\\end\{\1\}/gi, (match, env, inner) => {
    const rows = inner
      .trim()
      .split(/\\\\|\n/)
      .map((row: string) => row.trim())
      .filter((row: string) => row.length > 0)
      .map((row: string) => {
        const cols = row.split('&').map((c: string) => c.trim().replace(/^\\frac\{([^}]+)\}\{([^}]+)\}$/, '($1)/($2)'));
        return `[${cols.join(', ')}]`;
      });
    const matrixStr = `[${rows.join(', ')}]`;
    return match.toLowerCase().includes('det') ? `det(${matrixStr})` : matrixStr;
  });

  // Convert \begin{vmatrix} ... \end{vmatrix} (Determinant)
  s = s.replace(/\\begin\{vmatrix\}([\s\S]*?)\\end\{vmatrix\}/gi, (match, inner) => {
    const rows = inner
      .trim()
      .split(/\\\\|\n/)
      .map((row: string) => row.trim())
      .filter((row: string) => row.length > 0)
      .map((row: string) => {
        const cols = row.split('&').map((c: string) => c.trim().replace(/^\\frac\{([^}]+)\}\{([^}]+)\}$/, '($1)/($2)'));
        return `[${cols.join(', ')}]`;
      });
    return `det([${rows.join(', ')}])`;
  });

  // Normalize determinant wrappers: \det([...]) or det(...)
  s = s.replace(/\\det\s*\((.*?)\)/gi, 'det($1)');
  s = s.replace(/\\det\s*(\[\[[\s\S]*?\]\])/gi, 'det($1)');

  // Normalize inverse: A^{-1} or ([...])^{-1} or inv([...])
  s = s.replace(/(\[\[[\s\S]*?\]\])\^\{-1\}/g, 'inv($1)');
  s = s.replace(/\\text\{inv\}\s*\((.*?)\)/gi, 'inv($1)');

  // Normalize eigenvalue requests: \text{eigen}(...)
  s = s.replace(/\\text\{eigen\}\s*\((.*?)\)/gi, 'eigen($1)');

  // Clean up extra whitespace
  s = s.replace(/\s{2,}/g, ' ');

  return s;
}

// Helper function to reconstruct 2D matrices from multiline OCR text or number grids
function parseMatrixFromTesseract(rawText: string): string | null {
  if (!rawText) return null;

  // 1. If it contains an equals sign '=', it is an algebraic equation (e.g. 6x^2 - 17x + 12 = 0), NEVER a matrix
  if (rawText.includes('=')) {
    return null;
  }

  // 2. If it contains typical calculus/trig functions or variable powers, it's not a matrix
  if (/\b(sin|cos|tan|log|ln|lim|int|integrate|derive)\b/i.test(rawText) || /[a-zA-Z]\^[0-9]/.test(rawText)) {
    return null;
  }

  // Check if determinant is requested or indicated by vertical bars
  const isDet = /det|\|/i.test(rawText) && !/\[\s*\[/.test(rawText);

  // 3. Line-by-line 2D grid detection
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const rowCandidates: string[][] = [];

  for (const line of lines) {
    // Strip common bracket & vertical line artifacts so numbers aren't concatenated with borders
    const cleaned = line
      .replace(/\|{2,}/g, ' ')
      .replace(/\|/g, ' ')
      .replace(/[—–−]/g, '-')
      .replace(/[[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract all numbers on this line
    const tokens = cleaned.match(/-?\d+(?:\.\d+)?/g);
    if (tokens && tokens.length >= 2) {
      rowCandidates.push(tokens);
    }
  }

  // If at least 2 lines of numbers were detected
  if (rowCandidates.length >= 2) {
    // Determine optimal column count
    const lengths = rowCandidates.map(r => r.length);
    const countMap: Record<number, number> = {};
    lengths.forEach(l => { countMap[l] = (countMap[l] || 0) + 1; });

    const numRows = rowCandidates.length;
    const maxCols = Math.max(...lengths);

    // If row count matches maxCols (e.g. 4 rows with max 4 cols), it is a square matrix (e.g. 4x4)
    let targetCols: number;
    if (numRows === maxCols && maxCols >= 2) {
      targetCols = maxCols;
    } else {
      // Find most frequent length, but break ties in favor of the larger column count to avoid truncating valid numbers
      const sortedCols = Object.keys(countMap)
        .map(Number)
        .sort((a, b) => {
          const diff = countMap[b] - countMap[a];
          return diff !== 0 ? diff : b - a; // tie-breaker: larger column count wins
        });
      targetCols = sortedCols[0];
    }

    // Format consistent rows, intelligently splitting merged numbers or padding with 0 if an OCR artifact dropped a number
    const formattedRows = rowCandidates.map(r => {
      let tokens = [...r];

      // If missing exactly 1 column, check if a multi-digit number was merged by Tesseract (e.g., "41" -> "4", "1")
      if (tokens.length === targetCols - 1) {
        let splitDone = false;
        // First try 2-digit tokens (e.g., "41" -> "4", "1")
        for (let i = 0; i < tokens.length; i++) {
          if (/^\d{2}$/.test(tokens[i])) {
            const t = tokens[i];
            tokens.splice(i, 1, t[0], t[1]);
            splitDone = true;
            break;
          }
        }
        // If not split yet, try 3-digit tokens (e.g., "111" -> "11", "1")
        if (!splitDone) {
          for (let i = 0; i < tokens.length; i++) {
            if (/^\d{3}$/.test(tokens[i])) {
              const t = tokens[i];
              tokens.splice(i, 1, t.slice(0, 2), t.slice(2));
              splitDone = true;
              break;
            }
          }
        }
      }

      if (tokens.length < targetCols) {
        return `[${[...tokens, ...Array(targetCols - tokens.length).fill("0")].join(', ')}]`;
      }
      return `[${tokens.slice(0, targetCols).join(', ')}]`;
    });

    const mat = `[${formattedRows.join(', ')}]`;
    return isDet ? `det(${mat})` : mat;
  }

  // 4. Fallback for when OCR completely flattened line-breaks into a single line of space-separated numbers
  // For example: "9 13 5 2 11 7 6 3 7 4 6 0 7 10 1 2"
  const allTokens = rawText
    .replace(/[—–−]/g, '-')
    .replace(/[[\]()|]/g, ' ')
    .match(/-?\d+(?:\.\d+)?/g);

  // Only consider if there are NO algebraic variables in the text
  const hasAlgebraLetters = /[a-zA-Z]/.test(rawText.replace(/det|inv|eigen/gi, ''));

  if (!hasAlgebraLetters && allTokens && allTokens.length >= 4) {
    // 4 numbers -> 2x2
    if (allTokens.length === 4) {
      const mat = `[[${allTokens[0]}, ${allTokens[1]}], [${allTokens[2]}, ${allTokens[3]}]]`;
      return isDet ? `det(${mat})` : mat;
    }
    // 9 numbers -> 3x3
    if (allTokens.length === 9) {
      const mat = `[[${allTokens[0]}, ${allTokens[1]}, ${allTokens[2]}], [${allTokens[3]}, ${allTokens[4]}, ${allTokens[5]}], [${allTokens[6]}, ${allTokens[7]}, ${allTokens[8]}]]`;
      return isDet ? `det(${mat})` : mat;
    }
    // 16 numbers -> 4x4
    if (allTokens.length === 16) {
      const r1 = allTokens.slice(0, 4);
      const r2 = allTokens.slice(4, 8);
      const r3 = allTokens.slice(8, 12);
      const r4 = allTokens.slice(12, 16);
      const mat = `[[${r1.join(', ')}], [${r2.join(', ')}], [${r3.join(', ')}], [${r4.join(', ')}]]`;
      return isDet ? `det(${mat})` : mat;
    }
    // 6 numbers -> 2x3 or 3x2
    if (allTokens.length === 6) {
      const mat = `[[${allTokens[0]}, ${allTokens[1]}, ${allTokens[2]}], [${allTokens[3]}, ${allTokens[4]}, ${allTokens[5]}]]`;
      return isDet ? `det(${mat})` : mat;
    }
  }

  return null;
}

// Intelligent, human-like Math Reasoning Tutor fallback
function generateSmartMathTutorReply(userQuestion: string, context?: string): string {
  const q = userQuestion.toLowerCase().trim();

  // Greetings & Persona Questions
  if (/^(hi|hello|hey|greetings|who are you|what can you do)/i.test(q)) {
    return "Hello! I'm your AI Math Tutor. I can help you solve equations step-by-step, explain mathematical intuition, analyze graphs, or answer any math questions. What would you like to explore together?";
  }

  // Discriminant & Quadratic Questions
  if (q.includes("discriminant") || q.includes("d =") || q.includes("b^2 - 4ac") || q.includes("delta")) {
    if (context && context.includes("D =")) {
      return `The discriminant, D = b² - 4ac, tells us the nature of the roots! Geometrically, if D is positive, the parabola cuts the x-axis in two places. If D is zero, it just kisses the x-axis at its vertex. And if D is negative, the parabola never touches the x-axis in the real plane, meaning the roots are complex conjugate pairs.`;
    }
    return "The discriminant, D = b² - 4ac, reveals how many real solutions exist: positive means 2 distinct real roots, zero means exactly 1 repeated root, and negative means 2 complex roots involving the imaginary unit i.";
  }

  // Complex Numbers & Imaginary Unit
  if (q.includes("complex") || q.includes("imaginary") || q.includes("square root of negative") || q.includes("negative under root")) {
    return "When we take the square root of a negative number, we define the imaginary unit i where i² = -1. Complex solutions come in conjugate pairs like a + bi and a - bi. They represent real algebraic solutions that exist beyond the 1D real number line in the 2D complex plane!";
  }

  // Why Factor / Factoring vs Quadratic Formula
  if (q.includes("why factor") || q.includes("why use quadratic formula") || q.includes("difference between methods")) {
    return "Factoring is fastest when the roots are clean rational numbers because you simply look for two numbers that multiply to c and add to b. The quadratic formula, on the other hand, is a universal superpower—it always works, even for ugly decimals, irrational roots, or complex numbers.";
  }

  // Derivative / Calculus Questions
  if (q.includes("derivative") || q.includes("differentiate") || q.includes("rate of change") || q.includes("slope")) {
    return "A derivative f'(x) gives you the instantaneous rate of change or tangent slope of a curve at any point. For power terms xⁿ, we use the power rule: multiply by the exponent and drop the power by 1 to get n·xⁿ⁻¹.";
  }

  // Integral / Area Questions
  if (q.includes("integral") || q.includes("integrate") || q.includes("area under")) {
    return "Integration is the reverse process of differentiation! It accumulates continuous quantities to calculate the net area under a curve. The plus C represents any constant that vanished when differentiating.";
  }

  // Matrix / Eigenvalue Questions
  if (q.includes("eigenvalue") || q.includes("eigenvector") || q.includes("determinant")) {
    return "An eigenvalue is a special scalar λ where multiplying the matrix by its eigenvector only stretches or shrinks that vector without rotating it: A·v = λ·v. The determinant measures how much the linear transformation scales area or volume.";
  }

  // "Explain this step" or context explanation
  if (q.includes("explain this step") || q.includes("why did we do this") || q.includes("what is happening here") || q.includes("help me understand")) {
    if (context) {
      return `In this step, we're simplifying the expression to isolate our target variable and reveal the core structure. ${context.replace(/CURRENT SCREEN CONTEXT:/i, "").trim()}`;
    }
    return "In this step, we apply algebraic transformations to isolate the variable while keeping both sides of the equation balanced.";
  }

  return "I'm here to help guide you through this problem step-by-step. What specific part would you like to explore or clarify?";
}

// AI Chat endpoint connected to API key (NVIDIA Nemotron / Gemini / Ollama / Fallback)
app.post('/api/chat', express.json(), async (req, res) => {
  try {
    const { messages, context, apiKey: clientApiKey } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required." });
    }

    const lastUserMessage = messages[messages.length - 1]?.content || "";
    const customApiKey = (req.headers["x-api-key"] as string) || clientApiKey || "";

    // 1. Primary Engine: Python Backend (Runs NVIDIA Nemotron with Thinking Budget & Math Tools)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 35000);
      const backendRes = await fetch("http://127.0.0.1:4000/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(req.headers["authorization"] ? { "Authorization": req.headers["authorization"] as string } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          messages,
          context,
          api_key: customApiKey || undefined
        })
      });
      clearTimeout(timeout);

      if (backendRes.ok) {
        const data = await backendRes.json() as any;
        if (data && (data.reply || data.reasoning)) {
          return res.json(data);
        }
      }
    } catch (backendErr: any) {
      console.warn("[Chat] Backend port 4000 not responding, trying direct API / fallback:", backendErr.message);
    }

    // 2. Secondary Engine: Direct NVIDIA API call via HTTPS if NVIDIA_API_KEY is available
    const activeNvidiaKey = (customApiKey && !customApiKey.startsWith("AIzaSy") ? customApiKey : null) || process.env.NVIDIA_API_KEY;
    if (activeNvidiaKey) {
      try {
        const systemContent = `You are Axiom, an extraordinarily smart, warm, and intuitive human-like AI Math Professor and Voice Tutor.
Explain mathematical steps, intuition, and concepts clearly and concisely.
Use standard LaTeX notation ($...$ or $$...$$) where appropriate for math formulas. Keep answers focused (2-4 sentences).
${context ? `ACTIVE CONTEXT:\n${context}` : ""}`;

        const nController = new AbortController();
        const nTimeout = setTimeout(() => nController.abort(), 35000);

        const nvidiaRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${activeNvidiaKey}`
          },
          signal: nController.signal,
          body: JSON.stringify({
            model: process.env.NVIDIA_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b",
            messages: [
              { role: "system", content: systemContent },
              ...messages
            ],
            extra_body: {
              chat_template_kwargs: { enable_thinking: true },
              reasoning_budget: 2048
            },
            max_tokens: 4096,
            temperature: 0.6
          })
        });
        clearTimeout(nTimeout);

        if (nvidiaRes.ok) {
          const nData = await nvidiaRes.json() as any;
          const choice = nData.choices?.[0];
          const reply = choice?.message?.content?.trim();
          const reasoning = choice?.message?.reasoning_content?.trim() || undefined;
          if (reply || reasoning) {
            return res.json({
              reply: reply || "Analysis complete.",
              reasoning
            });
          }
        }
      } catch (nvidiaErr: any) {
        console.warn("[Chat] Direct NVIDIA API error:", nvidiaErr.message);
      }
    }

    // 3. Tertiary Engine: Google Gemini API if configured
    const activeGeminiKey = (customApiKey && customApiKey.startsWith("AIzaSy") ? customApiKey : null) || process.env.GEMINI_API_KEY;
    if (activeGeminiKey && activeGeminiKey !== "MY_GEMINI_API_KEY") {
      try {
        const client = new GoogleGenAI({ apiKey: activeGeminiKey });
        const geminiPrompt = `You are Axiom, a friendly, brilliant AI Math Tutor.
Context: ${context || ''}
User: ${lastUserMessage}
Answer concisely, intuitively, and warmly in 2-3 sentences.`;

        const geminiRes = await client.models.generateContent({
          model: "gemini-2.5-flash",
          contents: geminiPrompt
        });
        const reply = geminiRes.text?.trim();
        if (reply) {
          return res.json({ reply });
        }
      } catch (geminiErr: any) {
        console.warn("[Chat] Direct Gemini call error:", geminiErr.message);
      }
    }

    // 4. Local Ollama if explicitly enabled
    if (process.env.OLLAMA_ENABLED === "true") {
      try {
        const ollamaUrl = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
        const ollamaModel = process.env.OLLAMA_MODEL || "llama3";
        const oController = new AbortController();
        const oTimeout = setTimeout(() => oController.abort(), 2000);
        const ollamaRes = await fetch(`${ollamaUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: oController.signal,
          body: JSON.stringify({
            model: ollamaModel,
            messages,
            stream: false
          })
        });
        clearTimeout(oTimeout);
        if (ollamaRes.ok) {
          const oData = await ollamaRes.json() as any;
          const reply = oData.message?.content?.trim();
          if (reply) return res.json({ reply });
        }
      } catch (oErr) {
        // Fall through
      }
    }

    // 5. Intelligent Built-in Math Tutor Fallback
    const fallbackReply = generateSmartMathTutorReply(lastUserMessage, context);
    return res.json({ reply: fallbackReply });

  } catch (err: any) {
    console.error("[Chat] Unexpected error:", err.message);
    const fallback = generateSmartMathTutorReply(req.body?.messages?.[req.body.messages.length - 1]?.content || "", req.body?.context);
    return res.json({ reply: fallback });
  }
});

// Chat engine status endpoint
app.get('/api/chat/status', (req, res) => {
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  res.json({
    connected: Boolean(nvidiaKey || geminiKey),
    engine: nvidiaKey ? "NVIDIA Nemotron 3.5" : geminiKey ? "Google Gemini" : "Built-in Math Engine",
    model: process.env.NVIDIA_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b",
    hasKey: Boolean(nvidiaKey || geminiKey),
  });
});

app.use("/api", backendProxy);
app.use("/media", backendProxy);

// Removed old endpoint definition

// Full mathematical pre-renders/fallbacks to ensure 100% functionality without API key as a fallback
const PRESETS: Record<string, any> = {
  "quadratic": {
    equation: "x^2 - 5x + 6 = 0",
    equationType: "Quadratic Equation",
    summary: "A standard quadratic polynomial which can be resolved by factoring or the quadratic formula, finding two real roots at x = 2 and x = 3.",
    finalAnswer: "x = 2 \\quad \\text{and} \\quad x = 3",
    scenes: [
      {
        sceneNumber: 1,
        title: "Identify the Coefficients",
        subTitle: "Step 1: standard form ax^2 + bx + c = 0",
        explanation: "First, let's compare our equation with the standard quadratic form, a x squared plus b x plus c equals zero. We identify that a equals 1, b equals negative 5, and c equals 6.",
        primaryMath: "x^2 - 5x + 6 = 0",
        secondaryMath: "a = 1, \\quad b = -5, \\quad c = 6",
        graphData: {
          showGraph: true,
          functionExpr: "x*x - 5*x + 6",
          functionLabel: "f(x) = x^2 - 5x + 6",
          roots: [2, 3],
          intercepts: ["(0, 6)"],
          vertex: { x: 2.5, y: -0.25 },
          viewPort: { minX: -1, maxX: 6, minY: -2, maxY: 10 }
        },
        annotations: [
          { type: "circle", label: "y-intercept at (0,6)", coordinates: [0, 6] }
        ]
      },
      {
        sceneNumber: 2,
        title: "Calculate the Discriminant",
        subTitle: "Step 2: D = b^2 - 4ac",
        explanation: "To see if there are real solutions, we calculate the discriminant, often symbolized as d, which equals b squared minus four a c. Substituting our coefficients, we get negative five squared minus four times one times six. This reduces to twenty-five minus twenty-four, yielding a positive one. Since the discriminant is positive, we are guaranteed to find two distinct real solutions.",
        primaryMath: "D = b^2 - 4ac",
        secondaryMath: "D = (-5)^2 - 4(1)(6) = 25 - 24 = 1",
        graphData: {
          showGraph: true,
          functionExpr: "x*x - 5*x + 6",
          functionLabel: "D = 1 > 0 \\quad (\\text{Two Real Roots})",
          roots: [2, 3],
          intercepts: ["(0, 6)"],
          vertex: { x: 2.5, y: -0.25 },
          viewPort: { minX: -1, maxX: 6, minY: -2, maxY: 10 }
        },
        annotations: []
      },
      {
        sceneNumber: 3,
        title: "Apply the Quadratic Formula",
        subTitle: "Step 3: Substitutions",
        explanation: "Now we plug our coefficients a, b, and the discriminant into the quadratic formula. x equals minus b plus or minus the square root of the discriminant, all over two a. Plugging in our values gives x equals minus, negative five, plus or minus the square root of one, divided by two times one. This simplifies to x equals five plus or minus one, over two.",
        primaryMath: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
        secondaryMath: "x = \\frac{-(-5) \\pm \\sqrt{1}}{2(1)} = \\frac{5 \\pm 1}{2}",
        graphData: {
          showGraph: true,
          functionExpr: "x*x - 5*x + 6",
          functionLabel: "Solving for x",
          roots: [2, 3],
          intercepts: ["(0, 6)"],
          vertex: { x: 2.5, y: -0.25 },
          viewPort: { minX: -1, maxX: 6, minY: -2, maxY: 10 }
        },
        annotations: []
      },
      {
        sceneNumber: 4,
        title: "Resolve the Two Solutions",
        subTitle: "Step 4: Branching plus and minus",
        explanation: "We now branch into our two mathematical paths, one using plus, and the other using minus. For the first path, we calculate x equals five plus one, divided by two. That gives six divided by two, which simplifies to three. For the second path, x equals five minus one, divided by two. That gives four divided by two, which simplifies to two.",
        primaryMath: "x_1 = \\frac{5 + 1}{2} = 3, \\quad x_2 = \\frac{5 - 1}{2} = 2",
        secondaryMath: "\\text{Roots at } x = 2 \\text{ and } x = 3",
        graphData: {
          showGraph: true,
          functionExpr: "x*x - 5*x + 6",
          functionLabel: "f(x) intersects the X-axis at 2 and 3",
          roots: [2, 3],
          intercepts: ["(0, 6)"],
          vertex: { x: 2.5, y: -0.25 },
          viewPort: { minX: 1, maxX: 4, minY: -1, maxY: 3 }
        },
        annotations: [
          { type: "circle", label: "Root (2,0)", coordinates: [2, 0] },
          { type: "circle", label: "Root (3,0)", coordinates: [3, 0] }
        ]
      }
    ]
  },
  "trig": {
    equation: "sin(x) = 0.5",
    equationType: "Trigonometric Equation",
    summary: "Solving the trigonometric equation sin(x) = 0.5 over the principal interval [0, 2pi].",
    finalAnswer: "x = \\frac{\\pi}{6} \\quad \\text{and} \\quad x = \\frac{5\\pi}{6}",
    scenes: [
      {
        sceneNumber: 1,
        title: "Understand the Trigonometric Identity",
        subTitle: "Step 1: Find reference angles",
        explanation: "We are looking for all values of x in radians on the interval from zero to two pi, such that the sine of x equals zero point five. On the standard unit circle, sine corresponds to the y-coordinate.",
        primaryMath: "\\sin(x) = 0.5 \\quad \\text{for} \\quad x \\in [0, 2\\pi]",
        secondaryMath: "y = 0.5 \\text{ line on the Unit Circle}",
        graphData: {
          showGraph: true,
          functionExpr: "Math.sin(x)",
          functionLabel: "f(x) = sin(x)",
          roots: [0.5235, 2.618], // pi/6, 5pi/6
          intercepts: ["(0,0)"],
          vertex: { x: 1.57, y: 1 },
          viewPort: { minX: -1, maxX: 7, minY: -1.5, maxY: 1.5 }
        },
        annotations: [
          { type: "line", label: "Target y = 0.5", coordinates: [-1, 0.5, 7, 0.5] }
        ]
      },
      {
        sceneNumber: 2,
        title: "The First Quadrant Root",
        subTitle: "Step 2: Primary Principal Solution",
        explanation: "In the first quadrant, we know from special tri-angles that the sine of thirty degrees, or pi over six radians, is precisely zero point five. This gives us our first solution.",
        primaryMath: "x_1 = \\arcsin(0.5) = \\frac{\\pi}{6} \\approx 0.524",
        secondaryMath: "\\text{Quadrant I: positive sine values}",
        graphData: {
          showGraph: true,
          functionExpr: "Math.sin(x)",
          functionLabel: "First solution at x = pi/6",
          roots: [0.5235],
          intercepts: ["(0,0)"],
          vertex: { x: 0.5235, y: 0.5 },
          viewPort: { minX: -1, maxX: 4, minY: -1.5, maxY: 1.5 }
        },
        annotations: [
          { type: "circle", label: "Root I (pi/6, 0.5)", coordinates: [0.5235, 0.5] }
        ]
      },
      {
        sceneNumber: 3,
        title: "The Second Quadrant Root",
        subTitle: "Step 3: Symmetric Solution",
        explanation: "Sine is also positive in the second quadrant. Using trigonometric symmetry, we calculate the second angle as pi minus the reference angle, pi over six. This yields five pi over six radians, which is our second principal solution.",
        primaryMath: "x_2 = \\pi - \\frac{\\pi}{6} = \\frac{5\\pi}{6} \\approx 2.618",
        secondaryMath: "\\text{Quadrant II: positive sine values}",
        graphData: {
          showGraph: true,
          functionExpr: "Math.sin(x)",
          functionLabel: "Second solution at x = 5pi/6",
          roots: [2.618],
          intercepts: ["(0,0)"],
          vertex: { x: 2.618, y: 0.5 },
          viewPort: { minX: -1, maxX: 4, minY: -1.5, maxY: 1.5 }
        },
        annotations: [
          { type: "circle", label: "Root II (5pi/6, 0.5)", coordinates: [2.618, 0.5] }
        ]
      }
    ]
  },
  "limit": {
    equation: "lim x->0 (sin(x) / x)",
    equationType: "Calculus Limit",
    summary: "Evaluating the fundamental trigonometric limit using analysis, squeeze theorem or L'Hopital's rule.",
    finalAnswer: "1",
    scenes: [
      {
        sceneNumber: 1,
        title: "Observe the Indeterminate Form",
        subTitle: "Step 1: Direct Substitution",
        explanation: "We want to evaluate the limit as x approaches zero, of standard sine x, divided by x. If we try to substitute x equals zero directly, we get sine-of-zero divided by zero. Since sine-of-zero is zero, we get zero over zero. This is a classic indeterminate form.",
        primaryMath: "\\lim_{x \\to 0} \\frac{\\sin(x)}{x}",
        secondaryMath: "\\frac{\\sin(0)}{0} = \\frac{0}{0} \\quad (\\text{Indeterminate})",
        graphData: {
          showGraph: true,
          functionExpr: "x !== 0 ? Math.sin(x)/x : 1",
          functionLabel: "f(x) = sin(x)/x",
          roots: [],
          intercepts: ["(0, 1 - hole)"],
          vertex: { x: 0, y: 1 },
          viewPort: { minX: -5, maxX: 5, minY: -0.5, maxY: 1.5 }
        },
        annotations: [
          { type: "circle", label: "Removable singularity at (0,1)", coordinates: [0, 1] }
        ]
      },
      {
        sceneNumber: 2,
        title: "Apply L'Hôpital's Rule",
        subTitle: "Step 2: Differentiating numerator and denominator",
        explanation: "Since the expression is of the indeterminate form zero over zero, we can apply L'Hôpital's rule. This states that the limit of a quotient of functions is equal to the limit of the quotient of their derivatives. By differentiating the numerator we get cosine of x. Differentiating the denominator gives one.",
        primaryMath: "\\lim_{x \\to 0} \\frac{\\frac{d}{dx}[\\sin(x)]}{\\frac{d}{dx}[x]}",
        secondaryMath: "= \\lim_{x \\to 0} \\frac{\\cos(x)}{1}",
        graphData: {
          showGraph: true,
          functionExpr: "Math.cos(x)",
          functionLabel: "Derivative quotient: g(x) = cos(x)",
          roots: [],
          intercepts: ["(0,1)"],
          vertex: { x: 0, y: 1 },
          viewPort: { minX: -5, maxX: 5, minY: -0.5, maxY: 1.5 }
        },
        annotations: []
      },
      {
        sceneNumber: 3,
        title: "Evaluate the Simplification",
        subTitle: "Step 3: Direct substitution of derivative quotient",
        explanation: "Now we plug zero in directly to our differentiated expression. The cosine of zero equals one. Thus, one divided by one equals one. Our limit resolves beautifully to one, which matches our visual plot as the function smoothly approaches a height of one.",
        primaryMath: "\\lim_{x \\to 0} \\cos(x) = \\cos(0) = 1",
        secondaryMath: "\\text{The limit resolved is 1}",
        graphData: {
          showGraph: true,
          functionExpr: "x !== 0 ? Math.sin(x)/x : 1",
          functionLabel: "Smoothly approaches height of 1",
          roots: [],
          intercepts: ["(0,1)"],
          vertex: { x: 0, y: 1 },
          viewPort: { minX: -2, maxX: 2, minY: 0.5, maxY: 1.2 }
        },
        annotations: [
          { type: "circle", label: "Limit converges to 1", coordinates: [0, 1] }
        ]
      }
    ]
  }
};

/*
// API Endpoint to solve customized equations
app.post("/api/solve", async (req, res) => {
...
});
*/

// Socket helper to check if a port is open
function checkPort(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const onError = () => {
      socket.destroy();
      resolve(false);
    };
    socket.setTimeout(1000);
    socket.once("error", onError);
    socket.once("timeout", onError);
    socket.connect(port, host, () => {
      socket.end();
      resolve(true);
    });
  });
}

// Spawns the Python FastAPI backend if it is not already running
async function ensureBackendRunning() {
  const backendDir = path.resolve(process.cwd(), "../backend");

  // Try to see if it is already running
  const isRunning = await checkPort(4000, "127.0.0.1");
  if (isRunning) {
    console.log("Python backend is already running on port 4000.");
    return;
  }

  console.log("Python backend is not running. Starting Python backend...");
  const pythonCmd = process.platform === "win32" ? "python" : "python3";

  const pyProcess = spawn(pythonCmd, ["main.py"], {
    cwd: backendDir,
    stdio: "inherit",
    shell: true,
  });

  pyProcess.on("error", (err) => {
    console.error("Failed to start Python backend process:", err);
  });

  // Kill the child process when the Node process exits
  process.on("exit", () => {
    pyProcess.kill();
  });

  // Wait a moment for the server to spin up
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

// Serve frontend assets and listen
async function startServer() {
  await ensureBackendRunning();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
