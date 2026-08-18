import asyncio
import logging
import time
import os
import cv2
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from src.face_recognition import FaceRecognizer
from src.authentication import AuthenticationManager
from src.assistant.state import AssistantState
from src.web.websocket import ws_manager

logger = logging.getLogger("sunday.routes.auth")
router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class RegisterRequest(BaseModel):
    name: str

# Global variable to signal the generator to stop if another request comes in or if it completes
camera_active = False

async def generate_frames(request: Request, mode: str, name: str = None):
    global camera_active
    camera_active = True
    
    state: AssistantState = getattr(request.app.state, "assistant_state", None)
    auth_manager: AuthenticationManager = getattr(request.app.state, "auth_manager", None)
    recognizer: FaceRecognizer = getattr(request.app.state, "face_recognizer", None)
    
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        logger.error("Could not access webcam.")
        camera_active = False
        return

    # Broadcast camera active
    await ws_manager.broadcast({
        "event": "camera_status_change",
        "data": {"status": "ACTIVE", "mode": "SCANNING" if mode == "login" else "REGISTERING"}
    })

    try:
        if mode == "register" and name:
            save_dir = os.path.join("data", "faces", "authorized", name)
            os.makedirs(save_dir, exist_ok=True)
            capture_count = 0
            last_capture_time = time.time()
            
            while camera_active and capture_count < 5:
                # Need to run cap.read() in thread? cv2.VideoCapture is fast enough usually, 
                # but better to use asyncio.to_thread if we want true non-blocking. 
                # For simplicity in generator, we can do a small sleep.
                ret, frame = cap.read()
                if not ret:
                    await asyncio.sleep(0.05)
                    continue

                # Registration overlay
                cv2.putText(frame, f"Registering: {name}", (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 255, 255), 2)
                cv2.putText(frame, f"Photos: {capture_count}/5", (20, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 255, 0), 2)
                
                # Auto-capture every 1 second
                current_time = time.time()
                if current_time - last_capture_time > 1.0:
                    photo_filename = os.path.join(save_dir, f"{name}_{capture_count + 1}.jpg")
                    cv2.imwrite(photo_filename, frame)
                    capture_count += 1
                    last_capture_time = current_time
                    # Flash effect
                    cv2.rectangle(frame, (0,0), (frame.shape[1], frame.shape[0]), (255,255,255), -1)

                _, buffer = cv2.imencode('.jpg', frame)
                frame_bytes = buffer.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                await asyncio.sleep(0.03)

            if capture_count >= 5:
                # Reload faces
                if recognizer:
                    recognizer.load_known_faces()
                
                # Broadcast success via WS (so frontend can close the modal)
                # We can't return JSON from StreamingResponse, so WS is perfect.
                await ws_manager.broadcast({
                    "event": "register_success",
                    "data": {"name": name}
                })

        elif mode == "login":
            authenticated_user = None
            
            while camera_active and not authenticated_user:
                ret, frame = cap.read()
                if not ret:
                    await asyncio.sleep(0.05)
                    continue
                
                if recognizer and recognizer.known_face_names:
                    face_locations, names = recognizer.recognize(frame)
                    for (top, right, bottom, left), face_name in zip(face_locations, names):
                        top *= 4; right *= 4; bottom *= 4; left *= 4
                        is_auth = (face_name != "Unknown")
                        box_color = (0, 255, 0) if is_auth else (0, 0, 255)
                        
                        cv2.rectangle(frame, (left, top), (right, bottom), box_color, 2)
                        label = f"{face_name} - Authorized" if is_auth else "Unknown"
                        cv2.rectangle(frame, (left, bottom - 25), (right, bottom), box_color, cv2.FILLED)
                        cv2.putText(frame, label, (left + 6, bottom - 6), cv2.FONT_HERSHEY_DUPLEX, 0.55, (0, 0, 0) if is_auth else (255, 255, 255), 1)

                        if is_auth and not authenticated_user:
                            authenticated_user = face_name

                if authenticated_user:
                    cv2.putText(frame, f"ACCESS GRANTED: {authenticated_user}", (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 255, 0), 2)
                else:
                    cv2.putText(frame, "STATUS: SCANNING", (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

                _, buffer = cv2.imencode('.jpg', frame)
                frame_bytes = buffer.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                
                if authenticated_user:
                    if state: state.authenticate(authenticated_user)
                    if auth_manager: auth_manager.authenticate(authenticated_user)
                    
                    # Wait a tiny bit so the user sees the green box on the web UI
                    await asyncio.sleep(0.5)
                    
                    await ws_manager.broadcast({
                        "event": "auth_status_change",
                        "data": {"authenticated": True, "user": authenticated_user}
                    })
                    break
                
                await asyncio.sleep(0.03)
                
    finally:
        cap.release()
        camera_active = False
        await ws_manager.broadcast({
            "event": "camera_status_change",
            "data": {"status": "STANDBY", "mode": "IDLE"}
        })

@router.get("/video-feed")
async def video_feed(request: Request, mode: str = "login", name: str = None):
    return StreamingResponse(generate_frames(request, mode, name), media_type="multipart/x-mixed-replace; boundary=frame")

@router.post("/stop-camera")
async def stop_camera():
    global camera_active
    camera_active = False
    return {"success": True}

@router.get("/status")
async def get_auth_status(request: Request):
    state: AssistantState = getattr(request.app.state, "assistant_state", None)
    return {
        "authenticated": state.is_authenticated if state else False,
        "current_user": state.current_user if state else None
    }

@router.post("/logout")
async def perform_logout(request: Request):
    state: AssistantState = getattr(request.app.state, "assistant_state", None)
    auth_manager: AuthenticationManager = getattr(request.app.state, "auth_manager", None)
    if state: state.logout()
    if auth_manager: auth_manager.logout()
    await ws_manager.broadcast({
        "event": "auth_status_change",
        "data": {"authenticated": False, "user": None}
    })
    return {"success": True, "message": "Session locked."}
