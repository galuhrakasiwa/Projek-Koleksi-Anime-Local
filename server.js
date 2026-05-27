const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 5000;

// ===============================
// LOKASI FOLDER ANIME KAMU
// ===============================
// D:/ANIME = Anime yang sudah ditonton
// D:/UN    = Anime yang belum ditonton
const WATCHED_FOLDER = "D:/ANIME";
const UNWATCHED_FOLDER = "D:/UN";

// File cache lokal
const CACHE_FILE = path.join(__dirname, "anime-cache.json");

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ===============================
// HELPER
// ===============================
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readCache() {
  if (!fs.existsSync(CACHE_FILE)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(CACHE_FILE, "utf-8");
    return JSON.parse(raw || "{}");
  } catch (error) {
    console.error("Gagal membaca anime-cache.json:", error.message);
    return {};
  }
}

function writeCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
  } catch (error) {
    console.error("Gagal menulis anime-cache.json:", error.message);
  }
}

function cleanFolderName(folderName) {
  return folderName
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\([^\)]*\)/g, "")
    .replace(/\{[^\}]*\}/g, "")
    .replace(
      /\b(1080p|720p|480p|2160p|4K|BD|BluRay|BDrip|WEB-DL|WEBRip|HDTV|Batch|Complete|Sub Indo|Subtitle Indonesia|HEVC|x265|x264|AAC|FLAC)\b/gi,
      ""
    )
    .replace(/[_\.\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ensureFolderExists(folderPath) {
  if (!fs.existsSync(folderPath)) {
    console.warn(`Folder tidak ditemukan: ${folderPath}`);
    return false;
  }

  return true;
}

function scanAnimeFolder(folderPath, status) {
  if (!ensureFolderExists(folderPath)) {
    return [];
  }

  return fs
    .readdirSync(folderPath, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => ({
      folderName: item.name,
      folderPath: path.join(folderPath, item.name),
      status,
    }));
}

function getAllAnimeFolders() {
  const watchedAnime = scanAnimeFolder(WATCHED_FOLDER, "Sudah Ditonton");
  const unwatchedAnime = scanAnimeFolder(UNWATCHED_FOLDER, "Belum Ditonton");

  return [...watchedAnime, ...unwatchedAnime];
}

function createCacheKey(item) {
  return `${item.status}__${item.folderName}`;
}

// ===============================
// AMBIL DATA DARI JIKAN API
// ===============================
async function fetchAnimeFromJikan(item) {
  const query = cleanFolderName(item.folderName);
  const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(
    query
  )}&limit=1&sfw=true`;

  console.log(`Mencari data: [${item.status}] ${item.folderName} -> ${query}`);

  const maxRetry = 3;

  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        console.warn(
          `Rate limit Jikan untuk ${item.folderName}. Percobaan ${attempt}/${maxRetry}. Tunggu 10 detik...`
        );

        await sleep(10000);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Jikan API error: ${response.status}`);
      }

      const result = await response.json();
      const anime = result.data && result.data[0];

      if (!anime) {
        return {
          id: createCacheKey(item),
          folderName: item.folderName,
          folderPath: item.folderPath,
          status: item.status,
          title: query || item.folderName,
          titleEnglish: "",
          titleJapanese: "",
          image: "",
          synopsis: "Data tidak ditemukan di Jikan API.",
          genres: [],
          score: null,
          rating: "N/A",
          episodes: null,
          year: null,
          type: "",
          statusAiring: "",
          malUrl: "",
          cachedAt: new Date().toISOString(),
        };
      }

      return {
        id: createCacheKey(item),
        folderName: item.folderName,
        folderPath: item.folderPath,
        status: item.status,
        title: anime.title || query || item.folderName,
        titleEnglish: anime.title_english || "",
        titleJapanese: anime.title_japanese || "",
        image:
          anime.images?.webp?.large_image_url ||
          anime.images?.jpg?.large_image_url ||
          anime.images?.jpg?.image_url ||
          "",
        synopsis: anime.synopsis || "Sinopsis belum tersedia.",
        genres: Array.isArray(anime.genres)
          ? anime.genres.map((genre) => genre.name)
          : [],
        score: anime.score || null,
        rating: anime.rating || "N/A",
        episodes: anime.episodes || null,
        year: anime.year || null,
        type: anime.type || "",
        statusAiring: anime.status || "",
        malUrl: anime.url || "",
        cachedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        `Gagal mengambil data untuk ${item.folderName}. Percobaan ${attempt}/${maxRetry}:`,
        error.message
      );

      if (attempt < maxRetry) {
        await sleep(5000);
      }
    }
  }

  return {
    id: createCacheKey(item),
    folderName: item.folderName,
    folderPath: item.folderPath,
    status: item.status,
    title: query || item.folderName,
    titleEnglish: "",
    titleJapanese: "",
    image: "",
    synopsis: "Gagal mengambil data dari Jikan API setelah beberapa percobaan.",
    genres: [],
    score: null,
    rating: "N/A",
    episodes: null,
    year: null,
    type: "",
    statusAiring: "",
    malUrl: "",
    error: "Jikan API rate limit atau gagal koneksi.",
    cachedAt: new Date().toISOString(),
  };
}

// ===============================
// ROUTE UTAMA API ANIME
// ===============================
app.get("/api/anime", async (req, res) => {
  try {
    const animeFolders = getAllAnimeFolders();
    const cache = readCache();

    const animeList = [];
    let updatedCache = false;

    for (const item of animeFolders) {
      const cacheKey = createCacheKey(item);

      if (cache[cacheKey]) {
        animeList.push(cache[cacheKey]);
      } else {
        const animeData = await fetchAnimeFromJikan(item);

        cache[cacheKey] = animeData;
        animeList.push(animeData);
        updatedCache = true;

        // Simpan cache langsung setiap selesai 1 anime
        writeCache(cache);

        // Delay agar tidak terkena rate limit Jikan API
        await sleep(2000);
      }
    }

    if (updatedCache) {
      writeCache(cache);
    }

    animeList.sort((a, b) => {
      const statusOrder = a.status.localeCompare(b.status);

      if (statusOrder !== 0) {
        return statusOrder;
      }

      return a.title.localeCompare(b.title);
    });

    res.json({
      success: true,
      total: animeList.length,
      watchedTotal: animeList.filter(
        (anime) => anime.status === "Sudah Ditonton"
      ).length,
      unwatchedTotal: animeList.filter(
        (anime) => anime.status === "Belum Ditonton"
      ).length,
      anime: animeList,
    });
  } catch (error) {
    console.error("Error pada /api/anime:", error.message);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===============================
// RESET CACHE
// ===============================
app.post("/api/refresh", async (req, res) => {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
    }

    res.json({
      success: true,
      message: "Cache berhasil dihapus. Refresh halaman untuk scan ulang.",
    });
  } catch (error) {
    console.error("Gagal reset cache:", error.message);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ===============================
// CEK FOLDER
// ===============================
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    watchedFolder: WATCHED_FOLDER,
    unwatchedFolder: UNWATCHED_FOLDER,
    watchedFolderExists: fs.existsSync(WATCHED_FOLDER),
    unwatchedFolderExists: fs.existsSync(UNWATCHED_FOLDER),
    cacheFile: CACHE_FILE,
    cacheFileExists: fs.existsSync(CACHE_FILE),
  });
});

// ===============================
// HALAMAN DEFAULT
// ===============================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===============================
// JALANKAN SERVER
// ===============================
app.listen(PORT, () => {
  console.log("======================================");
  console.log("Anime Local Catalog berjalan");
  console.log(`URL Website        : http://localhost:${PORT}`);
  console.log(`URL Cek Folder     : http://localhost:${PORT}/api/health`);
  console.log(`Folder Ditonton    : ${WATCHED_FOLDER}`);
  console.log(`Folder Belum       : ${UNWATCHED_FOLDER}`);
  console.log("======================================");
});