@echo off
echo ===================================================
echo   Q-Table Visualizer V2 - Build Script
echo ===================================================

:: 1. Cleanup old files
echo [1/5] Cleaning up old build artifacts...

:: Check if the app is running and kill it if it is
tasklist /FI "IMAGENAME eq Q-Table-Visualizer-V2.exe" 2>NUL | find /I /N "Q-Table-Visualizer-V2.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo WARNING: Application is running. Attempting to close it...
    taskkill /F /IM Q-Table-Visualizer-V2.exe /T
    timeout /t 2 >nul
)

if exist "frontend\dist" rd /s /q "frontend\dist"
if exist "backend\dist\Q-Table-Visualizer-V2.exe" (
    del /f /q "backend\dist\Q-Table-Visualizer-V2.exe" 2>nul
    if exist "backend\dist\Q-Table-Visualizer-V2.exe" (
        echo.
        echo ERROR: Could not delete old executable. 
        echo Please ensure it is closed and not locked by another process.
        pause
        exit /b 5
    )
)
if exist "backend\dist" rd /s /q "backend\dist"
if exist "backend\build" rd /s /q "backend\build"
if exist "backend\frontend_static" rd /s /q "backend\frontend_static"

:: 2. Build Frontend
echo [2/5] Building Frontend...
cd frontend
call npm install
call npm run build
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Frontend build failed!
    pause
    exit /b %ERRORLEVEL%
)
cd ..

:: 3. Sync Frontend to Backend
echo [3/5] Copying Frontend build to Backend...
:: Using a different folder name to avoid conflict with PyInstaller's 'dist' output folder
xcopy /E /I /Y "frontend\dist" "backend\frontend_static"

:: 4. Setup Backend Environment
echo [4/5] Installing backend dependencies...
cd backend
python -m pip install -r requirements.txt
python -m pip install pyinstaller pywebview uvicorn
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Failed to install backend dependencies!
    pause
    exit /b %ERRORLEVEL%
)

:: 5. Build Executable
echo [5/5] Building Executable with PyInstaller...
:: --add-data "SOURCE;DEST" (DEST is relative to the internal bundle root)
:: We map frontend_static to 'dist' because app.py expects get_base_path() + '/dist'
python -m PyInstaller --name "Q-Table-Visualizer-V2" ^
    --onefile ^
    --noconsole ^
    --clean ^
    --add-data "frontend_static;dist" ^
    --collect-all webview ^
    --collect-all uvicorn ^
    app.py

if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: PyInstaller build failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo   BUILD SUCCESSFUL!
echo   Executable: v2\backend\dist\Q-Table-Visualizer-V2.exe
echo ===================================================
pause
