import os
import sys
import threading
import uvicorn
from fastapi import FastAPI
import webview
from main import app as fastapi_app

def get_base_path():
    """Get absolute path to resource, works for dev and for PyInstaller"""
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return base_path

def start_server():
    # Adding static files mount for the React build
    from fastapi.staticfiles import StaticFiles
    from starlette.responses import FileResponse
    
    frontend_dir = os.path.join(get_base_path(), "dist")
    
    if os.path.exists(frontend_dir):
        fastapi_app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dir, "assets")), name="assets")
        
        @fastapi_app.get("/{full_path:path}")
        async def serve_react_app(full_path: str):
            # If requesting a specific file that exists
            file_path = os.path.join(frontend_dir, full_path)
            if os.path.isfile(file_path):
                return FileResponse(file_path)
            # Otherwise return index.html for SPA routing
            return FileResponse(os.path.join(frontend_dir, "index.html"))

    uvicorn.run(fastapi_app, host="127.0.0.1", port=8000, log_level="warning")

class JSApi:
    def toggle_fullscreen(self):
        window = webview.active_window()
        if window:
            window.toggle_fullscreen()

if __name__ == '__main__':
    # Start FastAPI server in a separate thread
    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # Create the webview window
    webview.create_window(
        title="Q-Learning Interactive Visualizer V2",
        url="http://127.0.0.1:8000/",
        width=1200,
        height=800,
        min_size=(800, 600),
        js_api=JSApi()
    )
    
    # Start the GUI loop
    webview.start()
