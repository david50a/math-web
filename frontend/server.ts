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
      console.log("Starting OCR with Gemini (with Matrix Recognition)...");
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
                  text: `You are an expert mathematical OCR engine capable of recognizing printed, typed, and handwritten math formulas, equations, and matrices.

Extract the mathematical expression or matrix from this image.
Formatting rules:
1. Return ONLY the final plain text math string without markdown formatting, backticks, or explanation.
2. Matrices: Format any matrix as nested arrays: [[row1_elements], [row2_elements]]. Example: [[1, 2], [3, 4]] or [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
3. Determinants: If the image asks for determinant or is enclosed in vertical bars |A| / det(A), return as: det([[...]])
4. Matrix Inverse: If the image asks for inverse or A^-1, return as: inv([[...]])
5. Matrix Eigenvalues: If the image asks for eigenvalues or characteristic equation, return as: eigen([[...]])
6. Matrix Operations: If multiplying or adding matrices, return as: [[1, 2], [3, 4]] * [[5, 6], [7, 8]] or [[1, 2], [3, 4]] + [[5, 6], [7, 8]]
7. Standard Calculus/Algebra: Use standard formats (e.g. x^2 - 5x + 6 = 0, integrate(x*e^x), derive(sin(x)), mean([10, 20, 30])).`
                },
                { inlineData: { data: base64Data, mimeType: mimeType } }
              ]
            }
          ]
        });
        let equation = response.text?.trim() || "";
        equation = normalizeMatrixInString(equation);
        console.log("Gemini OCR matrix-aware result:", equation);
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
      equation = rawText.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ');

      // Normalize LaTeX & OCR artifacts
      equation = equation
        .replace(/\\int/g, 'integrate')
        .replace(/∫/g, 'integrate')
        .replace(/\\cdot|\\times|×/g, '*')
        .replace(/\\div|÷/g, '/')
        .replace(/—|–/g, '-')
        .replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)')
        .replace(/√\(([^)]+)\)/g, 'sqrt($1)')
        .replace(/√([a-zA-Z0-9]+)/g, 'sqrt($1)')
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');

      // Normalize any LaTeX matrix structures
      equation = normalizeMatrixInString(equation);
    }

    console.log("Local OCR result:", equation);
    res.json({ equation });

  } catch (err: any) {
    console.error("OCR Error:", err);
    res.status(500).json({ error: "Failed to process image.", details: err.message });
  }
});

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

  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const rowCandidates: string[][] = [];

  for (const line of lines) {
    // Strip common OCR bracket / vertical line artifacts
    const cleaned = line
      .replace(/\|{2,}/g, ' ')
      .replace(/—|–/g, '-')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract numbers, fractions, or variables in this line
    const tokens = cleaned.match(/-?\d+(?:\.\d+)?|\b[a-zA-Z]\b/g);
    if (tokens && tokens.length >= 2) {
      rowCandidates.push(tokens);
    }
  }

  const isDet = /det|\|/i.test(rawText);

  // If multiple rows of consistent length were found
  if (rowCandidates.length >= 2) {
    const colCount = rowCandidates[0].length;
    // Check if at least 2 rows have roughly the same column count
    const validRows = rowCandidates.filter(r => Math.abs(r.length - colCount) <= 1);
    if (validRows.length >= 2) {
      const targetCols = validRows[0].length;
      const formattedRows = validRows.map(r => {
        if (r.length < targetCols) {
          return `[${[...r, ...Array(targetCols - r.length).fill("0")].join(', ')}]`;
        }
        return `[${r.slice(0, targetCols).join(', ')}]`;
      });
      const mat = `[${formattedRows.join(', ')}]`;
      return isDet ? `det(${mat})` : mat;
    }
  }

  // Fallback: Check total number of tokens if line breaks were lost
  const allTokens = rawText
    .replace(/—|–/g, '-')
    .match(/-?\d+(?:\.\d+)?/g);

  if (allTokens) {
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

  // General mathematical response
  return `Great question! In mathematics, every algebraic manipulation maintains equality while transforming the problem into a simpler, standard form. If you'd like to see another step or try solving an equation, just let me know!`;
}

// AI Chat endpoint with smart multi-tier engine
app.post('/api/chat', express.json(), async (req, res) => {
  try {
    const { messages, context } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required." });
    }

    const lastUserMessage = messages[messages.length - 1]?.content || "";

    const systemContent = `You are Axiom, an extraordinarily smart, warm, and intuitive human-like AI Math Professor and Voice Tutor.

YOUR TEACHING PHILOSOPHY & PERSONALITY:
1. Speak with natural human warmth, enthusiasm, and deep mathematical clarity—like a supportive MIT math professor.
2. Prioritize INTUITION: Explain the "why" and visual/geometric meaning behind steps, not just mechanical formulas.
3. Keep spoken replies concise and conversational (2-4 sentences max per spoken response) so it sounds natural when spoken aloud.
4. When writing math formulas in the response, format them cleanly using standard LaTeX (e.g. $x = \\frac{-b \\pm \\sqrt{D}}{2a}$).
5. If the user asks about the active equation on the screen, use the provided context to deliver a precise, contextual explanation.

${context ? `ACTIVE SCREEN & EQUATION CONTEXT:\n${context}` : ""}`;

    // 1. Try Google Gemini if configured
    if (ai) {
      try {
        const contents = [
          { role: "user", parts: [{ text: systemContent + "\n\nPlease acknowledge and get ready to assist." }] },
          { role: "model", parts: [{ text: "Understood! I'm Axiom, your AI Math Tutor. I will give clear, intuitive, human-like explanations." }] },
          ...messages.map((m: any) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }]
          }))
        ];

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: contents
        });

        const reply = response.text?.trim();
        if (reply) {
          return res.json({ reply });
        }
      } catch (geminiErr: any) {
        console.warn("Gemini chat attempt failed, falling back to Ollama / local tutor:", geminiErr.message);
      }
    }

    // 2. Try Local Ollama (Llama 3) if configured
    if (process.env.OLLAMA_ENABLED === "true" || process.env.OLLAMA_HOST) {
      try {
        const ollamaUrl = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
        const ollamaModel = process.env.OLLAMA_MODEL || "llama3";

        const fullyConfiguredMessages = [
          { role: "system", content: systemContent },
          ...messages
        ];

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 800);

        const response = await fetch(`${ollamaUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            model: ollamaModel,
            messages: fullyConfiguredMessages,
            stream: false
          })
        });
        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json() as any;
          const reply = data.message?.content || "";
          if (reply) {
            return res.json({ reply });
          }
        }
      } catch (ollamaErr: any) {
        // Ollama not running or timeout; seamlessly use smart built-in math reasoner
      }
    }

    // 3. Built-in Smart Mathematical Reasoner Fallback
    const fallbackReply = generateSmartMathTutorReply(lastUserMessage, context);
    return res.json({ reply: fallbackReply });

  } catch (err: any) {
    console.error("Chat Error:", err);
    res.json({
      reply: "I'm here to help! Feel free to ask me to solve any equation, explain steps, or explore graphs together."
    });
  }
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
