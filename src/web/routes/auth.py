import asyncio
import logging
import os
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from src.face_recognition import FaceRecognizer, AUTHORIZED_DIR
from src.authentication import AuthenticationManager
from src.assistant.state import AssistantState
from src.web.websocket import ws_manager
from main import face_login
from register_face import register_face

logger = logging.getLogger("sunday.routes.auth")
router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class RegisterRequest(BaseModel):
    name: str


class QuickLoginRequest(BaseModel):
    name: str


@router.get("/status")
async def get_auth_status(request: Request):
    """Returns the current authentication status and user details."""
    state: AssistantState = getattr(request.app.state, "assistant_state", None)
    return {
        "authenticated": state.is_authenticated if state else False,
        "current_user": state.current_user if state else None
    }


@router.get("/users")
async def get_registered_users():
    """Returns a list of authorized user profile names registered in the system."""
    users = []
    if os.path.exists(AUTHORIZED_DIR):
        for item in os.listdir(AUTHORIZED_DIR):
            if os.path.isdir(os.path.join(AUTHORIZED_DIR, item)):
                users.append(item)
    return {"users": users, "count": len(users)}


@router.post("/face-login")
async def trigger_face_login(request: Request):
    """
    Activates the camera to verify user identity against known authorized face profiles.
    Runs asynchronously in a worker thread so the server remains responsive.
    """
    state: AssistantState = getattr(request.app.state, "assistant_state", None)
    auth_manager: AuthenticationManager = getattr(request.app.state, "auth_manager", None)
    recognizer: FaceRecognizer = getattr(request.app.state, "face_recognizer", None)

    if not recognizer:
        recognizer = FaceRecognizer()
        request.app.state.face_recognizer = recognizer

    # Broadcast camera active
    await ws_manager.broadcast({
        "event": "camera_status_change",
        "data": {"status": "ACTIVE", "mode": "SCANNING"}
    })

    try:
        # Run face_login in thread
        authenticated_user = await asyncio.to_thread(face_login, recognizer, state, auth_manager)

        if authenticated_user:
            # Broadcast successful authentication
            await ws_manager.broadcast({
                "event": "auth_status_change",
                "data": {"authenticated": True, "user": authenticated_user}
            })
            return {
                "success": True,
                "user": authenticated_user,
                "message": f"Biometric verification successful. Welcome, {authenticated_user}!"
            }
        else:
            return {
                "success": False,
                "user": None,
                "message": "Face verification cancelled or unrecognized."
            }
    except Exception as e:
        logger.error(f"Error during face login: {e}", exc_info=True)
        return {
            "success": False,
            "user": None,
            "message": f"Face verification error: {str(e)}"
        }
    finally:
        await ws_manager.broadcast({
            "event": "camera_status_change",
            "data": {"status": "STANDBY", "mode": "IDLE"}
        })


@router.post("/register-face")
async def trigger_register_face(req: RegisterRequest, request: Request):
    """
    Initiates the 5-photo camera capture routine to register a new authorized face profile.
    """
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty.")

    recognizer: FaceRecognizer = getattr(request.app.state, "face_recognizer", None)

    # Broadcast camera active
    await ws_manager.broadcast({
        "event": "camera_status_change",
        "data": {"status": "ACTIVE", "mode": "REGISTERING"}
    })

    try:
        # Run registration routine in worker thread
        success, registered_name = await asyncio.to_thread(register_face, name)

        if success:
            # Reload face encodings in memory
            if recognizer:
                await asyncio.to_thread(recognizer.load_known_faces)

            # Broadcast registration event
            await ws_manager.broadcast({
                "event": "register_success",
                "data": {"name": registered_name}
            })

            return {
                "success": True,
                "name": registered_name,
                "message": f"Face profile registered successfully for {registered_name}."
            }
        else:
            return {
                "success": False,
                "name": name,
                "message": "Face registration was cancelled or failed to capture required frames."
            }
    except Exception as e:
        logger.error(f"Error during face registration: {e}", exc_info=True)
        return {
            "success": False,
            "name": name,
            "message": f"Registration error: {str(e)}"
        }
    finally:
        await ws_manager.broadcast({
            "event": "camera_status_change",
            "data": {"status": "STANDBY", "mode": "IDLE"}
        })


@router.post("/quick-login")
async def quick_login(req: QuickLoginRequest, request: Request):
    """
    Direct profile selection login for authorized profiles or development testing.
    """
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")

    state: AssistantState = getattr(request.app.state, "assistant_state", None)
    auth_manager: AuthenticationManager = getattr(request.app.state, "auth_manager", None)

    if state:
        state.authenticate(name)
    if auth_manager:
        auth_manager.authenticate(name)

    await ws_manager.broadcast({
        "event": "auth_status_change",
        "data": {"authenticated": True, "user": name}
    })

    return {
        "success": True,
        "user": name,
        "message": f"Access granted for user: {name}"
    }


@router.post("/logout")
async def perform_logout(request: Request):
    """Locks the Sunday AI session and clears current authentication state."""
    state: AssistantState = getattr(request.app.state, "assistant_state", None)
    auth_manager: AuthenticationManager = getattr(request.app.state, "auth_manager", None)

    if state:
        state.logout()
    if auth_manager:
        auth_manager.logout()

    await ws_manager.broadcast({
        "event": "auth_status_change",
        "data": {"authenticated": False, "user": None}
    })

    return {"success": True, "message": "Session locked."}
