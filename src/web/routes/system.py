from fastapi import APIRouter, Request
from src.assistant.automation import Automation
import os
import platform

router = APIRouter(prefix="/api", tags=["System"])


@router.get("/status")
async def get_system_status(request: Request):
    """Returns the current operational status of Sunday AI and its sub-modules."""
    state = getattr(request.app.state, "assistant_state", None)
    
    is_authenticated = state.is_authenticated if state else False
    current_user = state.current_user if state else None

    # Check if AI brain key is configured
    ai_online = bool(os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY"))

    return {
        "status": "online",
        "authenticated": is_authenticated,
        "current_user": current_user,
        "modules": {
            "camera": "STANDBY",
            "microphone": "STANDBY",
            "ai_brain": "ONLINE" if ai_online else "OFFLINE",
            "memory": "READY",
            "automation": "ONLINE"
        },
        "system": {
            "os": platform.system(),
            "release": platform.release(),
            "machine": platform.machine()
        }
    }


@router.get("/system-info")
async def get_system_info():
    """Returns detailed OS & hardware information via Automation module."""
    info_text = Automation.system_info()
    return {
        "success": True,
        "info": info_text
    }
