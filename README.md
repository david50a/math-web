# Math Web (Axiom Engine)

A full-stack web application that solves mathematical problems across various domains (Algebra, Calculus, Statistics, Geometry, Linear Algebra) and generates instructional videos using Manim.

## Features

- **Math Solver**: Advanced parsing and solving for equations, derivatives, integrals, matrices, etc.
- **Video Generation**: Creates Manim-powered animations (up to 1080p60 for premium users) illustrating the step-by-step mathematical solutions.
- **AI Integration**: Integrates with Google Gemini via AI Studio for intelligent features.
- **User Authentication & Tiers**: Supports user sign-up, sign-in, and a premium tier for high-quality video exports and unlimited solves.

## Tech Stack

### Frontend
- **Framework**: React 19, Vite
- **Styling**: Tailwind CSS, Framer Motion
- **Icons**: Lucide React
- **Other**: Tesseract.js, Google GenAI SDK

### Backend
- **Framework**: FastAPI (Python)
- **Math Engine**: Custom Axiom Engine utilizing AST parsing, SymPy for algebra, and custom modules for calculus, stats, geometry, and matrices.
- **Video Rendering**: Manim
- **Database**: SQLite (`math_web.db`)

## Getting Started

### Prerequisites
- **Node.js** (v22+)
- **Python** (3.8+)
- **Manim dependencies** (e.g., FFmpeg, LaTeX if required for text rendering)

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install the required Python packages:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the FastAPI server:
   ```bash
   python main.py
   # or
   uvicorn main:app --host 0.0.0.0 --port 4000
   ```
   The backend will be available at `http://localhost:4000`.

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install the Node.js dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file and add your Gemini API Key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## Project Structure

- `frontend/`: React application containing components, styling, and Gemini AI integrations.
- `backend/`: FastAPI application handling user authentication, payments, the Axiom math engine logic, and Manim video generation.
  - `backend/engine/`: Core mathematical solving logic (derivatives, integrals, linear algebra, etc.).
  - `backend/media/`: Directory where rendered Manim videos are stored and served.

## License
MIT
