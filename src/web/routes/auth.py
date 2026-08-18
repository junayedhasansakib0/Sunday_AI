import os
import base64
import logging
import asyncio
import numpy as np
import cv2
import face_recognition
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from src.face_recognition import FaceRecognizer, AUTHORIZED_DIR
from src.authentication import AuthenticationManager
from src.assistant.state import AssistantState
from src.web.websocket import ws_manager

logger = logging.getLogger("sunday.routes.auth")
router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class VerifyFrameRequest(BaseModel):
    image: str  # Base64 data URL


class RegisterFrameRequest(BaseModel):
    name: str
    image: str
    shot_index: int  # 1 to 5


class QuickLoginRequest(BaseModel):
    name: str


def decode_base64_image(image_data: str) -> Optional[np.ndarray]:
    """Decodes a base64 JPEG/PNG data URL or raw base64 string into an OpenCV BGR image."""
    try:
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]
        image_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return frame
    except Exception as e:
        logger.error(f"Error decoding base64 image: {e}")
        return None


@router.get("/status")
async def get_auth_status(request: Request):
    """Returns current session authentication status."""
    state: AssistantState = getattr(request.app.state, "assistant_state", None)
    return {
        "authenticated": state.is_authenticated if state else False,
        "current_user": state.current_user if state else None
    }


@router.get("/users")
async def get_registered_users():
    """Returns a list of authorized user profile names."""
    users = []
    if os.path.exists(AUTHORIZED_DIR):
        for item in os.listdir(AUTHORIZED_DIR):
            if os.path.isdir(os.path.join(AUTHORIZED_DIR, item)):
                users.append(item)
    return {"users": users, "count": len(users)}


@router.post("/verify-frame")
async def verify_webcam_frame(req: VerifyFrameRequest, request: Request):
    """
    Processes a live snapshot frame captured from the browser's webcam.
    Performs face recognition against authorized encodings.
    """
    frame = decode_base64_image(req.image)
    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image data received.")

    state: AssistantState = getattr(request.app.state, "assistant_state", None)
    auth_manager: AuthenticationManager = getattr(request.app.state, "auth_manager", None)
    recognizer: FaceRecognizer = getattr(request.app.state, "face_recognizer", None)

    if not recognizer:
        recognizer = FaceRecognizer()
        request.app.state.face_recognizer = recognizer

    if not recognizer.known_face_names:
        return {
            "success": False,
            "authenticated": False,
            "user": None,
            "face_detected": False,
            "message": "No authorized face profiles registered in system. Please register a face first."
        }

    # Run recognition in thread pool to avoid blocking the async event loop
    face_locations, names = await asyncio.to_thread(recognizer.recognize, frame)

    authenticated_user = None
    detected_faces = []

    for (top, right, bottom, left), name in zip(face_locations, names):
        # Scale back coordinates up by 4 (since recognize scales down by 0.25)
        top *= 4
        right *= 4
        bottom *= 4
        left *= 4
        is_auth = (name != "Unknown")
        detected_faces.append({
            "name": name,
            "authorized": is_auth,
            "box": {"top": int(top), "right": int(right), "bottom": int(bottom), "left": int(left)}
        })
        if is_auth and not authenticated_user:
            authenticated_user = name

    if authenticated_user:
        if state:
            state.authenticate(authenticated_user)
        if auth_manager:
            auth_manager.authenticate(authenticated_user)

        # Broadcast authentication to open WebSocket sessions
        await ws_manager.broadcast({
            "event": "auth_status_change",
            "data": {"authenticated": True, "user": authenticated_user}
        })

        return {
            "success": True,
            "authenticated": True,
            "user": authenticated_user,
            "face_detected": True,
            "faces": detected_faces,
            "message": f"Biometric verification successful. Welcome, {authenticated_user}!"
        }

    return {
        "success": False,
        "authenticated": False,
        "user": None,
        "face_detected": len(face_locations) > 0,
        "faces": detected_faces,
        "message": "Face detected but not recognized." if face_locations else "Scanning for face..."
    }


@router.post("/register-frame")
async def register_webcam_frame(req: RegisterFrameRequest, request: Request):
    """
    Saves a captured snapshot frame from browser webcam into user dataset folder.
    When 5 photos are reached, reloads known encodings in memory.
    """
    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Profile name cannot be empty.")

    # Sanitize name
    safe_name = "".join(c for c in name if c.isalnum() or c in (" ", "_", "-")).strip()
    if not safe_name:
        raise HTTPException(status_code=400, detail="Invalid profile name.")

    frame = decode_base64_image(req.image)
    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image data.")

    save_dir = os.path.join(AUTHORIZED_DIR, safe_name)
    os.makedirs(save_dir, exist_ok=True)

    shot_idx = max(1, min(req.shot_index, 5))
    photo_path = os.path.join(save_dir, f"{safe_name}_{shot_idx}.jpg")
    cv2.imwrite(photo_path, frame)

    is_completed = (shot_idx >= 5)

    if is_completed:
        recognizer: FaceRecognizer = getattr(request.app.state, "face_recognizer", None)
        if recognizer:
            await asyncio.to_thread(recognizer.load_known_faces)

        await ws_manager.broadcast({
            "event": "register_success",
            "data": {"name": safe_name}
        })

    return {
        "success": True,
        "completed": is_completed,
        "saved_shot": shot_idx,
        "name": safe_name,
        "message": f"Photo {shot_idx}/5 saved successfully." if not is_completed else f"Face registration completed for '{safe_name}'!"
    }


@router.post("/quick-login")
async def quick_login(req: QuickLoginRequest, request: Request):
    """Direct profile selection for development or quick access."""
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
    """Locks the Sunday AI session."""
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
