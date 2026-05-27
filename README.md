Untuk project kamu, node_modules hanya perlu install ini:

npm install express cors

Karena di server.js kamu memakai:

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

Yang perlu di-install hanya:

express
cors

Sedangkan ini bawaan Node.js, jadi tidak perlu install:

fs
path

Kalau Node.js kamu versi lama dan muncul error:

fetch is not defined

baru install tambahan ini:

npm install node-fetch

Tapi kalau kamu pakai Node.js versi baru, biasanya tidak perlu node-fetch.

Jadi perintah lengkap paling aman:

cd "C:\Users\Acredia\Downloads\CODE\Projek Anime"
npm install express cors

Lalu jalankan:

node .\server.js

Buka:

http://localhost:5000
