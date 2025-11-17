"""
Nova Sonic Python - Main Application
Entry point that launches WebSocket server and Streamlit UI
"""
import asyncio
import threading
import subprocess
import sys
import time
from websocket_server import start_websocket_server
from config import PORT, WEBSOCKET_PORT, debug_print


def run_websocket_server():
    """Run the WebSocket server in a separate thread."""
    debug_print("Starting WebSocket server thread...")
    asyncio.run(start_websocket_server())


def run_streamlit():
    """Run the Streamlit UI."""
    debug_print(f"Starting Streamlit UI on port {PORT}...")
    subprocess.run([
        sys.executable, "-m", "streamlit", "run", "ui.py",
        "--server.port", str(PORT),
        "--server.headless", "true",
        "--browser.gatherUsageStats", "false"
    ])


def main():
    """Main entry point."""
    print("=" * 50)
    print("🎤 Nova Sonic Python - Voice Chat Application")
    print("=" * 50)
    print(f"📡 WebSocket Server: ws://localhost:{WEBSOCKET_PORT}")
    print(f"🌐 Streamlit UI: http://localhost:{PORT}")
    print("=" * 50)
    print()
    
    # Start WebSocket server in a separate thread
    ws_thread = threading.Thread(target=run_websocket_server, daemon=True)
    ws_thread.start()
    
    # Give WebSocket server time to start
    time.sleep(2)
    
    # Run Streamlit in the main thread
    try:
        run_streamlit()
    except KeyboardInterrupt:
        print("\n\n👋 Shutting down...")
        sys.exit(0)


if __name__ == "__main__":
    main()
