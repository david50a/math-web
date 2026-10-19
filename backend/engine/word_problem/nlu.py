import re
import os
import json
import httpx
from typing import Dict, Any, List, Optional
from .models import Entity, ProblemVariable

class NLUResult:
    def __init__(
        self,
        raw_text: str,
        entities: List[Dict[str, Any]],
        quantities: List[Dict[str, Any]],
        relations: List[Dict[str, Any]],
        question_targets: List[str],
        detected_category: str,
        detected_subcategory: str,
        llm_enhanced: bool = False,
        raw_llm_response: Optional[str] = None
    ):
        self.raw_text = raw_text
        self.entities = entities
        self.quantities = quantities
        self.relations = relations
        self.question_targets = question_targets
        self.detected_category = detected_category
        self.detected_subcategory = detected_subcategory
        self.llm_enhanced = llm_enhanced
        self.raw_llm_response = raw_llm_response

    def to_dict(self) -> Dict[str, Any]:
        return {
            "raw_text": self.raw_text,
            "entities": self.entities,
            "quantities": self.quantities,
            "relations": self.relations,
            "question_targets": self.question_targets,
            "detected_category": self.detected_category,
            "detected_subcategory": self.detected_subcategory,
            "llm_enhanced": self.llm_enhanced,
            "raw_llm_response": self.raw_llm_response
        }


# =========================================================================
# Rule-Based NLU Engine
# =========================================================================

UNIT_MAP = {
    "mph": "miles/hour",
    "km/h": "km/hour",
    "kmh": "km/hour",
    "kph": "km/hour",
    "m/s": "meters/second",
    "miles": "miles",
    "mile": "miles",
    "km": "km",
    "kilometers": "km",
    "m": "meters",
    "meter": "meters",
    "meters": "meters",
    "cm": "cm",
    "centimeters": "cm",
    "ft": "feet",
    "feet": "feet",
    "foot": "feet",
    "in": "inches",
    "inch": "inches",
    "inches": "inches",
    "hr": "hours",
    "hrs": "hours",
    "hour": "hours",
    "hours": "hours",
    "min": "minutes",
    "mins": "minutes",
    "minute": "minutes",
    "minutes": "minutes",
    "sec": "seconds",
    "seconds": "seconds",
    "second": "seconds",
    "days": "days",
    "day": "days",
    "percent": "%",
    "%": "%",
    "dollars": "USD",
    "dollar": "USD",
    "$": "USD",
    "usd": "USD",
    "euros": "EUR",
    "euro": "EUR",
    "€": "EUR",
    "eur": "EUR",
    "pounds": "GBP",
    "pound": "GBP",
    "£": "GBP",
    "gbp": "GBP",
    "shekels": "ILS",
    "shekel": "ILS",
    "₪": "ILS",
    "ils": "ILS",
    "sq meters": "sq meters",
    "square meters": "sq meters",
    "sq m": "sq meters",
    "m^2": "sq meters",
    "m²": "sq meters",
    "sq feet": "sq feet",
    "square feet": "sq feet",
    "sq ft": "sq feet",
    "ft^2": "sq feet",
    "ft²": "sq feet",
    "sq cm": "sq cm",
    "square centimeters": "sq cm",
    "cm^2": "sq cm",
    "cm²": "sq cm",
    "sq inches": "sq inches",
    "square inches": "sq inches",
    "sq in": "sq inches",
    "in^2": "sq inches",
    "in²": "sq inches",
    "sq yards": "sq yards",
    "square yards": "sq yards",
    "yards": "yards",
    "yard": "yards",
    "yd": "yards",
    "yds": "yards",
    "liters": "liters",
    "litres": "liters",
    "l": "liters",
    "gallons": "gallons",
    "years": "years",
    "year": "years",
}

QUANTITY_REGEX = re.compile(
    r'(?P<number>[+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*'
    r'(?P<unit>(?:mph|km/h|kmh|kph|m/s|sq\s*meters?|square\s*meters?|sq\s*m|m\^2|m²|sq\s*feet|square\s*feet|sq\s*ft|ft\^2|ft²|sq\s*cm|square\s*centimeters?|cm\^2|cm²|sq\s*inches?|square\s*inches?|sq\s*in|in\^2|in²|sq\s*yards?|square\s*yards?|kilometers?|km|centimeters?|cm|millimeters?|mm|meters?|miles?|mi|inches?|in|feet|foot|ft|yards?|yds?|yd|minutes?|mins?|min|seconds?|secs?|sec|hours?|hrs?|hr|days?|liters?|litres?|gallons?|years?|year|dollars?|euros?|pounds?|shekels?|percent)\b|\%)?',
    re.IGNORECASE
)

CURRENCY_PREFIX_REGEX = re.compile(r'([$€£₪₹])\s*(?P<number>\d+(?:\.\d+)?)')
CURRENCY_CODE_MAP = {
    '$': 'USD',
    '€': 'EUR',
    '£': 'GBP',
    '₪': 'ILS',
    '₹': 'INR'
}

def extract_rule_quantities(text: str) -> List[Dict[str, Any]]:
    quantities = []
    
    # Currency prefix symbols ($X, €X, £X, ₪X)
    for m in CURRENCY_PREFIX_REGEX.finditer(text):
        val = float(m.group("number"))
        sym = m.group(1)
        curr_code = CURRENCY_CODE_MAP.get(sym, "USD")
        quantities.append({
            "value": val,
            "unit": curr_code,
            "currency_symbol": sym,
            "raw": m.group(0),
            "start": m.start(),
            "end": m.end()
        })
        
    for m in QUANTITY_REGEX.finditer(text):
        # Avoid overlapping with currency match
        if m.start() > 0 and text[m.start()-1] in ['$','€','£','₪','₹']:
            continue
        try:
            val = float(m.group("number"))
            unit_raw = m.group("unit")
            unit_norm = UNIT_MAP.get(unit_raw.lower(), unit_raw) if unit_raw else None
            
            # Context around the number
            ctx_start = max(0, m.start() - 25)
            ctx_end = min(len(text), m.end() + 25)
            context = text[ctx_start:ctx_end].strip()
            
            quantities.append({
                "value": val,
                "unit": unit_norm,
                "raw": m.group(0).strip(),
                "context": context
            })
        except ValueError:
            continue
            
    return quantities

def extract_rule_entities(text: str) -> List[Dict[str, Any]]:
    entities = []
    t_lower = text.lower()
    
    # Vehicles & Actors
    for v in ["first train", "second train", "train a", "train b", "train", "car", "cyclist", "bus", "boat", "plane"]:
        if v in t_lower:
            entities.append({"name": v.title(), "category": "vehicle_actor"})
            
    # Geometric Shapes
    for s in ["right triangle", "triangle", "rectangle", "rectangular garden", "garden", "field", "circle", "cylinder", "cone", "sphere", "ladder", "wall"]:
        if s in t_lower:
            entities.append({"name": s.title(), "category": "geometric_shape"})
            
    # Economic / Objects
    for item in ["ticket", "tickets", "coin", "coins", "dimes", "nickels", "quarters", "adult", "child", "pipe", "tank", "cistern"]:
        if item in t_lower:
            entities.append({"name": item.title(), "category": "object"})
            
    # Persons / Names
    for p in ["alice", "bob", "john", "mary", "father", "son", "mother", "daughter"]:
        if p in t_lower:
            entities.append({"name": p.title(), "category": "person"})
            
    return entities

def extract_rule_targets(text: str) -> List[str]:
    targets = []
    t_lower = text.lower()
    
    # Common questions
    patterns = [
        (r'when\s+will.*catch\s+up', "catch_up_time"),
        (r'how\s+long\s+will\s+it\s+take', "time_elapsed"),
        (r'what\s+is\s+the\s+length\s+of\s+the\s+other\s+leg', "other_leg"),
        (r'find\s+its\s+length\s+and\s+width', "length_and_width"),
        (r'find\s+the\s+length', "length"),
        (r'find\s+the\s+width', "width"),
        (r'find\s+the\s+area', "area"),
        (r'what\s+is\s+the\s+hypotenuse', "hypotenuse"),
        (r'how\s+many\s+tickets', "ticket_count"),
        (r'how\s+many\s+hours', "hours_needed"),
        (r'find\s+the\s+speed', "speed"),
        (r'find\s+the\s+numbers?', "numbers"),
        (r'what\s+are\s+the\s+dimensions', "dimensions"),
    ]
    
    for pat, tgt in patterns:
        if re.search(pat, t_lower):
            targets.append(tgt)
            
    if not targets:
        # Fallback question detection
        q_match = re.search(r'(?:find|what\s+is|how\s+many|calculate|determine)\s+([^?.!,]+)', t_lower)
        if q_match:
            targets.append(q_match.group(1).strip())
        else:
            targets.append("unknown_value")
            
    return targets


# =========================================================================
# Local LLM Integration (Ollama / Fallbacks)
# =========================================================================

NLU_SYSTEM_PROMPT = """You are a rigorous Natural Language Understanding module for a mathematical word problem solving architecture.
Analyze the user's question and output a single JSON object with the following schema:
{
  "category": "motion | geometry | work_rate | linear_system | age | mixture | quadratic | calculus | general_algebra",
  "subcategory": "string (e.g. catch_up, pythagorean, perimeter_and_area, combined_work, ticket_system)",
  "entities": [
    {"name": "string", "category": "actor | geometric_shape | object | person", "properties": {}}
  ],
  "known_variables": [
    {"symbol": "string (e.g. v1, t_delay, l, w, h)", "name": "string", "value": number, "unit": "string", "description": "string"}
  ],
  "target_variables": [
    {"symbol": "string", "name": "string", "unit": "string", "description": "string"}
  ],
  "verbal_relationships": [
    "string expressing constraint in English and equation"
  ],
  "domain_assumptions": [
    "string e.g. constant speed, positive lengths"
  ]
}
Return ONLY pure JSON. No markdown backticks, no comments."""

async def query_local_llm_nlu(problem_text: str) -> Optional[Dict[str, Any]]:
    """Query local Ollama (llama3) or fallbacks with a strict JSON format."""
    ollama_model = os.environ.get("OLLAMA_MODEL", "llama3")
    
    # 1. Try local Ollama
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.post(
                "http://localhost:11434/api/chat",
                json={
                    "model": ollama_model,
                    "messages": [
                        {"role": "system", "content": NLU_SYSTEM_PROMPT},
                        {"role": "user", "content": f"Analyze this math word problem:\n{problem_text}"}
                    ],
                    "stream": False,
                    "format": "json"
                }
            )
            if resp.status_code == 200:
                data = resp.json()
                content = data.get("message", {}).get("content", "")
                if content:
                    return json.loads(content)
    except Exception as e:
        # Local Ollama not available or timed out
        pass

    # 2. Try Gemini if GEMINI_API_KEY is present
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if gemini_key:
        try:
            from google import genai
            client = genai.Client(api_key=gemini_key)
            prompt = f"{NLU_SYSTEM_PROMPT}\n\nProblem:\n{problem_text}"
            resp = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )
            if resp and resp.text:
                txt = resp.text.strip()
                if txt.startswith("```"):
                    txt = re.sub(r"^```(?:json)?", "", txt).strip()
                    txt = re.sub(r"```$", "", txt).strip()
                return json.loads(txt)
        except Exception:
            pass

    return None


async def understand_natural_language(problem_text: str) -> NLUResult:
    """
    Executes Stage 1: Natural Language Understanding (Local LLM + Rules).
    Combines rule-based deterministic extraction with Local LLM intelligence.
    """
    rule_quantities = extract_rule_quantities(problem_text)
    rule_entities = extract_rule_entities(problem_text)
    rule_targets = extract_rule_targets(problem_text)
    
    # Run Local LLM
    llm_data = await query_local_llm_nlu(problem_text)
    
    detected_cat = "general_algebra"
    detected_sub = "unknown"
    llm_enhanced = False
    
    if llm_data:
        llm_enhanced = True
        detected_cat = llm_data.get("category", "general_algebra")
        detected_sub = llm_data.get("subcategory", "unknown")
        
        # Merge entities
        llm_entities = llm_data.get("entities", [])
        combined_entities = rule_entities + [e for e in llm_entities if e.get("name") not in [r.get("name") for r in rule_entities]]
        
        return NLUResult(
            raw_text=problem_text,
            entities=combined_entities or rule_entities,
            quantities=rule_quantities,
            relations=llm_data.get("verbal_relationships", []),
            question_targets=rule_targets,
            detected_category=detected_cat,
            detected_subcategory=detected_sub,
            llm_enhanced=True,
            raw_llm_response=json.dumps(llm_data)
        )
    
    # Fallback entirely on Rules
    t_lower = problem_text.lower()
    if any(k in t_lower for k in ["train", "mph", "km/h", "speed", "traveling", "catch up", "miles per hour"]):
        detected_cat = "motion"
        detected_sub = "catch_up" if "catch up" in t_lower or "same direction" in t_lower else "relative_speed"
    elif any(k in t_lower for k in ["hypotenuse", "leg", "right triangle", "pythagor", "ladder"]):
        detected_cat = "geometry"
        detected_sub = "pythagorean"
    elif any(k in t_lower for k in ["perimeter", "area", "rectangle", "garden", "length and width", "width"]):
        detected_cat = "geometry"
        detected_sub = "perimeter_and_area"
    elif any(k in t_lower for k in ["alone", "together", "work", "fill", "tank", "pipes", "cistern"]):
        detected_cat = "work_rate"
        detected_sub = "combined_work"
    elif any(k in t_lower for k in ["ticket", "tickets", "coins", "dimes", "nickels", "$"]):
        detected_cat = "linear_system"
        detected_sub = "cost_and_quantity"
    elif any(k in t_lower for k in ["years old", "father", "son", "twice as old", "age"]):
        detected_cat = "age"
        detected_sub = "age_relationship"
    elif any(k in t_lower for k in ["mixture", "solution", "acid", "alloy", "percent", "%"]):
        detected_cat = "mixture"
        detected_sub = "concentration_mix"
    elif any(k in t_lower for k in ["consecutive integers", "product", "sum of squares"]):
        detected_cat = "quadratic"
        detected_sub = "number_properties"
        
    return NLUResult(
        raw_text=problem_text,
        entities=rule_entities,
        quantities=rule_quantities,
        relations=[],
        question_targets=rule_targets,
        detected_category=detected_cat,
        detected_subcategory=detected_sub,
        llm_enhanced=False
    )
