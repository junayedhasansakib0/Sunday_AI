from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from src.assistant.command_processor import CommandProcessor
from src.web.websocket import ws_manager
import logging

logger = logging.getLogger("sunday.routes.assistant")
router = APIRouter(prefix="/api", tags=["Assistant"])


class CommandRequest(BaseModel):
    command: str


class CommandResponse(BaseModel):
    success: bool
    command: str
    response: str


@router.post("/command", response_model=CommandResponse)
async def execute_command(req: CommandRequest, request: Request):
    """
    Executes a user command through the centralized Sunday AI CommandProcessor.
    Bridges safely into Automation or AI Brain.
    """
    command_text = req.command.strip()
    if not command_text:
        raise HTTPException(status_code=400, detail="Command cannot be empty.")

    command_processor: CommandProcessor = getattr(request.app.state, "command_processor", None)
    if not command_processor:
        # Fallback instant instance
        command_processor = CommandProcessor(state=getattr(request.app.state, "assistant_state", None))

    try:
        # Execute through core CommandProcessor
        result_text = command_processor.process(command_text)

        # Broadcast real-time event to all open WebSocket connections
        await ws_manager.broadcast({
            "event": "command_executed",
            "data": {
                "command": command_text,
                "response": result_text
            }
        })

        return CommandResponse(
            success=True,
            command=command_text,
            response=result_text
        )
    except Exception as e:
        logger.error(f"Error executing command '{command_text}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to execute command: {str(e)}")
