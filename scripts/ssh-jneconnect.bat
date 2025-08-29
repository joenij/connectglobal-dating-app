@echo off
REM SSH Wrapper für jneconnect.com ohne Passwort-Prompts
REM Usage: ssh-jneconnect.bat "command"

ssh -o BatchMode=yes -o ConnectTimeout=10 -o PreferredAuthentications=password -o PasswordAuthentication=yes root@91.98.117.106 %*