@echo off
setlocal
set "APP_HOME=%~dp0"
set "PYTHON_EXE="

if not exist "%APP_HOME%launcher.py" goto missing_files
if exist "%APP_HOME%Streetlens.html" goto files_ready
if exist "%APP_HOME%dist\index.html" goto files_ready
goto missing_files

:files_ready
rem Prefer an existing local Python installation. Never install software.
for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python3*") do if exist "%%~fD\python.exe" set "PYTHON_EXE=%%~fD\python.exe"
if defined PYTHON_EXE goto run_python

rem Exclude the Windows Store alias, which could open an installer.
for /f "delims=" %%P in ('where python.exe 2^>nul ^| findstr /v /i "WindowsApps"') do if not defined PYTHON_EXE set "PYTHON_EXE=%%P"
if defined PYTHON_EXE goto run_python

where py.exe >nul 2>nul
if errorlevel 1 goto missing_python
py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>nul
if errorlevel 1 goto missing_python
py -3 "%APP_HOME%launcher.py" %*
goto finished

:run_python
"%PYTHON_EXE%" -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>nul
if errorlevel 1 goto missing_python
"%PYTHON_EXE%" "%APP_HOME%launcher.py" %*
goto finished

:missing_files
echo [Streetlens] Extract the entire ZIP before running start.cmd.
echo Keep start.cmd and launcher.py beside dist/ or Streetlens.html.
goto failed

:missing_python
echo [Streetlens] Python 3.8 or newer is required.
echo No software was installed or system settings changed.
echo Install Python from https://www.python.org/downloads/ and run again.
echo See README.md for setup instructions.
goto failed

:finished
if errorlevel 1 goto failed
exit /b 0

:failed
echo.
if /i "%~1"=="--check" exit /b 1
pause
exit /b 1
