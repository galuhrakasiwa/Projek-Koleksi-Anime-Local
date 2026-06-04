@echo off
title Anime Local Catalog

cd /d "C:\Users\Acredia\Downloads\CODE\Projek Anime"

echo ================================
echo Menjalankan Anime Local Catalog
echo ================================
echo.

start http://localhost:5000

node server.js

pause