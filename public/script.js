const animeGrid = document.getElementById("animeGrid");
const statusArea = document.getElementById("statusArea");

const searchInput = document.getElementById("searchInput");
const genreFilter = document.getElementById("genreFilter");
const typeFilter = document.getElementById("typeFilter");
const sortFilter = document.getElementById("sortFilter");
const refreshBtn = document.getElementById("refreshBtn");

const totalAnime = document.getElementById("totalAnime");
const watchedAnime = document.getElementById("watchedAnime");
const unwatchedAnime = document.getElementById("unwatchedAnime");

const tabButtons = document.querySelectorAll(".tab-btn");

let animeData = [];
let activeStatus = "all";

async function loadAnime() {
  showStatus("Membaca folder anime dan menyiapkan katalog...", false);

  try {
    const response = await fetch("/api/anime");
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || "Gagal mengambil data anime.");
    }

    animeData = result.anime || [];

    totalAnime.textContent = result.total || 0;
    watchedAnime.textContent = result.watchedTotal || 0;
    unwatchedAnime.textContent = result.unwatchedTotal || 0;

    buildGenreFilter(animeData);
    buildTypeFilter(animeData);
    applyFilters();

    if (animeData.length === 0) {
      showStatus(
        "Belum ada folder anime yang ditemukan di D:/ANIME atau D:/UN.",
        false
      );
    }
  } catch (error) {
    showStatus(
      `Frontend gagal menghubungi backend Node.js. Pastikan server berjalan dan kamu membuka website dari http://localhost:5000. Detail error: ${error.message}`,
      true
    );
  }
}

function buildGenreFilter(data) {
  const genres = new Set();

  data.forEach((anime) => {
    if (Array.isArray(anime.genres)) {
      anime.genres.forEach((genre) => genres.add(genre));
    }
  });

  genreFilter.innerHTML = `<option value="all">Semua Genre</option>`;

  Array.from(genres)
    .sort()
    .forEach((genre) => {
      const option = document.createElement("option");
      option.value = genre;
      option.textContent = genre;
      genreFilter.appendChild(option);
    });
}

function buildTypeFilter(data) {
  const types = new Set();

  data.forEach((anime) => {
    if (anime.type) {
      types.add(anime.type);
    }
  });

  typeFilter.innerHTML = `<option value="all">Semua Type</option>`;

  Array.from(types)
    .sort()
    .forEach((type) => {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type;
      typeFilter.appendChild(option);
    });
}

function applyFilters() {
  const keyword = searchInput.value.toLowerCase().trim();
  const selectedGenre = genreFilter.value;
  const selectedType = typeFilter.value;
  const selectedSort = sortFilter.value;

  let filtered = animeData.filter((anime) => {
    const searchableText = [
      anime.title,
      anime.titleEnglish,
      anime.titleJapanese,
      anime.folderName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchSearch = searchableText.includes(keyword);

    const matchGenre =
      selectedGenre === "all" ||
      (Array.isArray(anime.genres) && anime.genres.includes(selectedGenre));

    const matchType = selectedType === "all" || anime.type === selectedType;

    const matchStatus = activeStatus === "all" || anime.status === activeStatus;

    return matchSearch && matchGenre && matchType && matchStatus;
  });

  filtered = sortAnimeList(filtered, selectedSort);

  renderAnime(filtered);
}

function sortAnimeList(data, sortMode) {
  const sorted = [...data];

  sorted.sort((a, b) => {
    const titleA = a.title || a.folderName || "";
    const titleB = b.title || b.folderName || "";

    const scoreA = Number(a.score) || 0;
    const scoreB = Number(b.score) || 0;

    const yearA = Number(a.year) || 0;
    const yearB = Number(b.year) || 0;

    switch (sortMode) {
      case "rating-desc":
        return scoreB - scoreA;

      case "rating-asc":
        return scoreA - scoreB;

      case "year-desc":
        return yearB - yearA;

      case "year-asc":
        return yearA - yearB;

      case "title-asc":
      default:
        return titleA.localeCompare(titleB);
    }
  });

  return sorted;
}

function renderAnime(data) {
  animeGrid.innerHTML = "";

  if (data.length === 0) {
    showStatus("Anime tidak ditemukan berdasarkan filter saat ini.", false);
    return;
  }

  hideStatus();

  const fragment = document.createDocumentFragment();

  data.forEach((anime) => {
    const card = document.createElement("article");
    card.className = "card";

    const genres =
      Array.isArray(anime.genres) && anime.genres.length
        ? anime.genres
            .slice(0, 4)
            .map((genre) => `<span class="chip">${escapeHtml(genre)}</span>`)
            .join("")
        : `<span class="chip">Unknown</span>`;

    const badgeClass =
      anime.status === "Sudah Ditonton" ? "watched" : "unwatched";

    const smallMeta = [
      anime.year,
      anime.type,
      anime.episodes ? `${anime.episodes} eps` : "",
    ]
      .filter(Boolean)
      .join(" • ");

    card.innerHTML = `
      <div class="poster-wrap">
        ${
          anime.image
            ? `<img class="poster" src="${escapeHtml(anime.image)}" alt="${escapeHtml(
                anime.title || anime.folderName
              )}">`
            : `<div class="poster-fallback">Poster tidak tersedia</div>`
        }

        <div class="watch-badge ${badgeClass}">
          ${escapeHtml(anime.status)}
        </div>

        <div class="score-badge">
          ${renderStars(anime.score)} ${anime.score || "N/A"}
        </div>
      </div>

      <div class="content">
        <h2 class="title">${escapeHtml(anime.title || "Unknown Title")}</h2>

        <div class="folder">
          Folder: ${escapeHtml(anime.folderName || "-")}
        </div>

        <div class="meta">
          ${genres}
        </div>

        <p class="synopsis">
          ${escapeHtml(anime.synopsis || "Sinopsis belum tersedia.")}
        </p>

        <div class="footer">
          <span>${escapeHtml(smallMeta || anime.rating || "N/A")}</span>
          ${
            anime.malUrl
              ? `<a class="mal-link" href="${escapeHtml(
                  anime.malUrl
                )}" target="_blank" rel="noopener noreferrer">MAL</a>`
              : `<span></span>`
          }
        </div>
      </div>
    `;

    fragment.appendChild(card);
  });

  animeGrid.appendChild(fragment);
}

function renderStars(score) {
  if (!score) return "☆";

  const maxStars = 5;
  const starCount = Math.round((Number(score) / 10) * maxStars);

  return "★".repeat(starCount) + "☆".repeat(maxStars - starCount);
}

function showStatus(message, isError) {
  statusArea.textContent = message;
  statusArea.style.display = "block";

  if (isError) {
    statusArea.classList.add("error");
  } else {
    statusArea.classList.remove("error");
  }
}

function hideStatus() {
  statusArea.style.display = "none";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function resetCache() {
  const confirmReset = confirm(
    "Yakin ingin menghapus cache? Setelah itu backend akan scan ulang dan mengambil data dari Jikan API lagi."
  );

  if (!confirmReset) return;

  try {
    showStatus("Menghapus cache dan memuat ulang data...", false);

    const response = await fetch("/api/refresh", {
      method: "POST",
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || "Gagal reset cache.");
    }

    animeData = [];
    animeGrid.innerHTML = "";

    totalAnime.textContent = "0";
    watchedAnime.textContent = "0";
    unwatchedAnime.textContent = "0";

    await loadAnime();
  } catch (error) {
    showStatus(`Gagal reset cache: ${error.message}`, true);
  }
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    tabButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");

    activeStatus = button.dataset.status;
    applyFilters();
  });
});

searchInput.addEventListener("input", applyFilters);
genreFilter.addEventListener("change", applyFilters);
typeFilter.addEventListener("change", applyFilters);
sortFilter.addEventListener("change", applyFilters);
refreshBtn.addEventListener("click", resetCache);

loadAnime();