@echo off
REM Delegates directly to restart_app.bat (Google ADK + Auto-Restart Supervisor)
call "%~dp0restart_app.bat" %*
exit /b %ERRORLEVEL%
