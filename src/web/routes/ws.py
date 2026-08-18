import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from src.web.websocket import ws_manager
from src.assistant.command_processor import CommandProcessor

logger = logging.getLogger("sunday.routes.ws")
router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    
    # Send initial connection handshake
    state = getattr(websocket.app.state, "assistant_state", None)
    await ws_manager.send_personal_message({
        "event": "connection_established",
        "data": {
            "status": "connected",
            "authenticated": state.is_authenticated if state else False,
            "current_user": state.current_user if state else None,
            "message": "Sunday AI Neural Link Online"
        }
    }, websocket)

    try:
        while True:
            data_text = await websocket.receive_text()
            try:
                msg = json.loads(data_text)
                event_type = msg.get("event")
                
                if event_type == "ping":
                    await ws_manager.send_personal_message({"event": "pong"}, websocket)
                
                elif event_type == "command":
                    command_text = msg.get("data", {}).get("command", "").strip()
                    if command_text:
                        command_processor: CommandProcessor = getattr(websocket.app.state, "command_processor", None)
                        if not command_processor:
                            command_processor = CommandProcessor(state=state)
                        
                        response_text = command_processor.process(command_text)
                        
                        # Broadcast response to all clients so UI stays in sync
                        await ws_manager.broadcast({
                            "event": "command_executed",
                            "data": {
                                "command": command_text,
                                "response": response_text
                            }
                        })
            except json.JSONDecodeError:
                logger.warning(f"Malformed WebSocket message received: {data_text}")

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)
