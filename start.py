#!/usr/bin/env python3
"""
TheCreditWhisperers App Launcher
Simple script to start both backend and frontend servers
"""

import subprocess
import time
import sys
import os
from pathlib import Path

def main():
    print("=" * 50)
    print("Starting TheCreditWhisperers App")
    print("=" * 50)
    print()

    # Get the project root directory
    project_root = Path(__file__).parent
    backend_dir = project_root / "backend"
    frontend_dir = project_root / "frontend"

    # Kill existing Python and Node processes
    print("Cleaning up existing processes...")
    subprocess.run(["taskkill", "/F", "/IM", "python.exe"],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(["taskkill", "/F", "/IM", "node.exe"],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(2)

    # Start backend server
    print("Starting Backend Server...")
    backend_cmd = [
        "powershell", "-Command",
        f"cd '{backend_dir}'; .\\venv\\Scripts\\Activate.ps1; python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
    ]
    subprocess.Popen(
        backend_cmd,
        creationflags=subprocess.CREATE_NEW_CONSOLE,
        cwd=str(backend_dir)
    )

    # Wait for backend to initialize
    print("Waiting for backend to initialize...")
    time.sleep(8)

    # Start frontend server
    print("Starting Frontend Server...")
    frontend_cmd = ["npm", "start"]
    subprocess.Popen(
        frontend_cmd,
        creationflags=subprocess.CREATE_NEW_CONSOLE,
        cwd=str(frontend_dir),
        shell=True
    )

    print()
    print("=" * 50)
    print("Application is starting!")
    print("=" * 50)
    print("Backend:  http://localhost:8000")
    print("Frontend: http://localhost:3000")
    print("API Docs: http://localhost:8000/docs")
    print()
    print("Both servers are running in separate windows.")
    print("Close those windows to stop the servers.")
    print()

    # Wait a bit then open browser
    time.sleep(5)
    print("Opening browser...")
    subprocess.run(["start", "http://localhost:3000"], shell=True)

    print()
    print("Press Enter to exit this window...")
    input()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nExiting...")
        sys.exit(0)
    except Exception as e:
        print(f"\nError: {e}")
        input("Press Enter to exit...")
        sys.exit(1)
