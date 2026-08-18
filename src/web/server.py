import os
import logging
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from src.assistant.state import AssistantState
from src.assistant.command_processor import CommandProcessor
from src.ai.brain import AIBrain
from src.web.routes.system import router as system_router
from src.web.routes.assistant import router as assistant_router
from src.web.routes.ws import router as ws_router

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("sunday.web")

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = Path(__file__).resolve().parent / "templates"


def create_app() -> FastAPI:
    """Creates and configures the Sunday AI FastAPI application."""
    app = FastAPI(
        title="Sunday AI Neural Dashboard",
        description="Next-generation Web Interface and Control Plane for Sunday AI Personal Assistant",
        version="1.0.0"
    )

    # CORS configuration for local safety
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Ensure required static and template directories exist
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    (STATIC_DIR / "css").mkdir(parents=True, exist_ok=True)
    (STATIC_DIR / "js").mkdir(parents=True, exist_ok=True)
    (STATIC_DIR / "assets").mkdir(parents=True, exist_ok=True)
    TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)

    # Mount static assets
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

    # Setup Jinja2 templates
    templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

    # Initialize Core Shared State & Processors
    assistant_state = AssistantState()
    ai_brain = AIBrain()
    command_processor = CommandProcessor(state=assistant_state, brain=ai_brain)

    app.state.assistant_state = assistant_state
    app.state.ai_brain = ai_brain
    app.state.command_processor = command_processor

    # Include API & WebSocket Routers
    app.include_router(system_router)
    app.include_router(assistant_router)
    app.include_router(ws_router)

    # Dashboard Homepage Route
    @app.get("/", summary="Sunday AI Main Web Dashboard")
    async def index(request: Request):
        return templates.TemplateResponse(
            request=request,
            name="index.html",
            context={
                "app_name": "Sunday AI",
                "version": "1.0.0"
            }
        )

    logger.info("Sunday AI Web Application initialized successfully.")
    return app


# Application entry point for uvicorn
app = create_app()
