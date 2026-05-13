import os
from typing import List
from manim import config, Scene, FadeIn, FadeOut, ReplacementTransform, MathTex, Matrix, Graph, Tex, Text, UP, DOWN, LEFT, RIGHT, BLUE, GREEN
from math_models import MathStep, Node, Const, Var, Add, Mul, Pow

def get_tree_data(node, vertices=None, edges=None, labels=None, parent=None):
    if vertices is None:
        vertices, edges, labels = [], [], {}
    
    v_id = len(vertices)
    vertices.append(v_id)
    
    if isinstance(node, Const):
        val = int(node.value) if abs(node.value - int(node.value)) < 1e-9 else node.value
        labels[v_id] = Text(str(val), font_size=20)
    elif isinstance(node, Var):
        labels[v_id] = MathTex(node.name, font_size=30)
    elif isinstance(node, Add):
        labels[v_id] = Text("+", font_size=30)
    elif isinstance(node, Mul):
        labels[v_id] = Text("×", font_size=30)
    elif isinstance(node, Pow):
        labels[v_id] = Text("^", font_size=30)
    
    if parent is not None:
        edges.append((parent, v_id))
    
    if isinstance(node, (Add, Mul)):
        get_tree_data(node.left, vertices, edges, labels, v_id)
        get_tree_data(node.right, vertices, edges, labels, v_id)
    elif isinstance(node, Pow):
        get_tree_data(node.base, vertices, edges, labels, v_id)
        # Exponent leaf
        exp_id = len(vertices)
        vertices.append(exp_id)
        labels[exp_id] = Text(str(node.exp), font_size=20)
        edges.append((v_id, exp_id))
        
    return vertices, edges, labels

class MathStepsScene(Scene):
    def __init__(self, steps: List[MathStep], title_str: str, **kwargs):
        self.steps = steps
        self.title_str = title_str
        super().__init__(**kwargs)

    def construct(self):
        if not self.steps:
            return

        # Title
        title = Tex(self.title_str, font_size=36).to_edge(UP)
        self.play(FadeIn(title))
        self.wait(1)

        current_equation = None
        current_tree = None

        for i, step in enumerate(self.steps):
            # Explanation text
            explanation = Text(step.description, font_size=24).to_edge(DOWN)
            self.play(FadeIn(explanation))

            # New Equation Mobject
            if step.type == "matrix":
                matrix_data = step.data if step.data else [[0]]
                formatted_data = [[(str(int(val)) if abs(val - int(val)) < 1e-9 else f"{val:.2f}") for val in row] for row in matrix_data]
                new_equation = Matrix(formatted_data, element_to_mobject=Text).scale(0.7).shift(LEFT * 3)
                new_tree = None
            elif step.type == "text":
                # For regular text, we use Tex instead of MathTex to avoid latex formatting errors
                # We replace newlines with Manim's way of handling them or just strip them.
                clean_text = str(step.latex)
                if "\\\\" in clean_text:
                    # Very simple formatting for text steps that might have matrix/equation newlines
                    clean_text = clean_text.replace("\\\\", "\n")
                new_equation = Text(clean_text, font_size=24).scale(1.2).shift(LEFT * 3.5)
                new_tree = None
            else: # "equation"
                new_equation = MathTex(step.latex).scale(1.2).shift(LEFT * 3.5)
                
                # New Tree Mobject
                if step.data and isinstance(step.data, Node):
                    v, e, l = get_tree_data(step.data)
                    new_tree = Graph(
                        v, e, labels=l, 
                        layout="tree", root_vertex=0,
                        vertex_config={"radius": 0.3, "color": BLUE},
                        edge_config={"stroke_width": 2}
                    ).scale(0.8).shift(RIGHT * 3)
                else:
                    new_tree = None

            # Transitions
            anims = []
            if current_equation is None:
                anims.append(FadeIn(new_equation))
            else:
                anims.append(ReplacementTransform(current_equation, new_equation))
            
            if new_tree:
                if current_tree is None:
                    anims.append(FadeIn(new_tree))
                else:
                    anims.append(FadeOut(current_tree))
                    anims.append(FadeIn(new_tree))
            elif current_tree:
                anims.append(FadeOut(current_tree))

            if anims:
                self.play(*anims)
            
            current_equation = new_equation
            current_tree = new_tree
            
            self.wait(2)
            self.play(FadeOut(explanation))

        # Final result
        self.wait(1)
        final_text = Text("Finished!", color=GREEN).to_edge(DOWN)
        self.play(FadeIn(final_text))
        self.wait(2)

def generate_solver_video(steps: List[MathStep], title: str, output_path: str):
    """
    Generates a Manim video for the given steps.
    
    Args:
        steps: The list of MathStep objects to animate.
        title: The title of the animation.
        output_path: The full file path (including .mp4 extension) to save the video.
    """
    output_dir = os.path.dirname(output_path)
    output_file = os.path.basename(output_path)
    
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
        
    config.media_dir = output_dir
    config.output_file = output_file
    
    # Render the scene
    scene = MathStepsScene(steps, title)
    scene.render()
