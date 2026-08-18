import uvicorn
import os
import sys

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))


def main():
    host = os.getenv("SUNDAY_HOST", "127.0.0.1")
    port = int(os.getenv("SUNDAY_PORT", 8000))
    reload = os.getenv("SUNDAY_RELOAD", "false").lower() == "true"

    print("=" * 60)
    print("           SUNDAY AI - NEURAL WEB SERVER")
    print("=" * 60)
    print(f"  [+] Starting Web Dashboard on: http://{host}:{port}")
    print(f"  [+] Real-time WebSockets on:  ws://{host}:{port}/ws")
    print(f"  [+] REST API documentation:    http://{host}:{port}/docs")
    print("=" * 60)
    print("Press Ctrl+C to shut down server.\n")

    uvicorn.run(
        "src.web.server:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info"
    )


if __name__ == "__main__":
    main()
