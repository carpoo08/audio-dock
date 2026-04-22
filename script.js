const audioInput = document.getElementById("audio-input");
const dropzone = document.getElementById("dropzone");
const playlist = document.getElementById("playlist");
const audioPlayer = document.getElementById("audio-player");
const trackTitle = document.getElementById("track-title");
const trackMeta = document.getElementById("track-meta");
const fileCount = document.getElementById("file-count");
const statusText = document.getElementById("status-text");
const previousButton = document.getElementById("previous-button");
const nextButton = document.getElementById("next-button");
const sortButton = document.getElementById("sort-button");
const playFirstButton = document.getElementById("play-first-button");
const installButton = document.getElementById("install-button");
const clearButton = document.getElementById("clear-button");

const DB_NAME = "audio-dock-db";
const STORE_NAME = "tracks";

const tracks = [];
let activeTrackId = null;
let nextTrackId = 1;
let deferredInstallPrompt = null;
let dbPromise = null;

function formatBytes(bytes) {
  if (!bytes) {
    return "크기 정보 없음";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function setStatus(message) {
  statusText.textContent = message;
}

function updateSummary() {
  fileCount.textContent = `${tracks.length}개`;
}

function splitSortableName(name) {
  const stem = name.replace(/\.[^.]+$/, "");

  return stem
    .split(/(\d+)/)
    .filter(Boolean)
    .map((part) => {
      if (/^\d+$/.test(part)) {
        return {
          type: "number",
          value: Number(part),
        };
      }

      return {
        type: "text",
        value: part.toLowerCase(),
      };
    });
}

function compareTrackNames(leftTrack, rightTrack) {
  const leftParts = splitSortableName(leftTrack.file.name);
  const rightParts = splitSortableName(rightTrack.file.name);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const left = leftParts[index];
    const right = rightParts[index];

    if (!left) {
      return -1;
    }

    if (!right) {
      return 1;
    }

    if (left.type === right.type) {
      if (left.value < right.value) {
        return -1;
      }

      if (left.value > right.value) {
        return 1;
      }

      continue;
    }

    if (left.type === "number") {
      return -1;
    }

    return 1;
  }

  return leftTrack.file.name.localeCompare(rightTrack.file.name, "ko-KR", {
    numeric: true,
    sensitivity: "base",
  });
}

function sortTracks() {
  tracks.sort(compareTrackNames);
  renderPlaylist();
}

function getActiveIndex() {
  return tracks.findIndex((track) => track.id === activeTrackId);
}

function updateNavigationButtons() {
  const activeIndex = getActiveIndex();
  const hasTracks = tracks.length > 0;

  previousButton.disabled = !hasTracks || activeIndex <= 0;
  nextButton.disabled = !hasTracks || activeIndex === -1 || activeIndex >= tracks.length - 1;
}

function resetPlayerDetails() {
  trackTitle.textContent = "재생할 파일을 선택하세요";
  trackMeta.textContent = "아직 업로드된 오디오가 없습니다.";
}

function renderPlaylist() {
  playlist.innerHTML = "";

  if (tracks.length === 0) {
    const emptyState = document.createElement("li");
    emptyState.className = "empty-state";
    emptyState.textContent = "업로드한 파일이 여기에 표시됩니다.";
    playlist.appendChild(emptyState);
    updateNavigationButtons();
    return;
  }

  for (const track of tracks) {
    const item = document.createElement("li");
    item.className = "playlist-item";

    if (track.id === activeTrackId) {
      item.classList.add("is-active");
    }

    const details = document.createElement("div");
    details.className = "track-details";

    const name = document.createElement("strong");
    name.textContent = track.file.name;

    const meta = document.createElement("span");
    meta.textContent = `${track.file.type || "audio file"} · ${formatBytes(track.file.size)}`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "playlist-button";
    button.textContent = "재생";
    button.addEventListener("click", () => playTrack(track.id));

    details.append(name, meta);
    item.append(details, button);
    playlist.appendChild(item);
  }

  updateNavigationButtons();
}

function revokeTrackUrls() {
  for (const track of tracks) {
    if (track.url) {
      URL.revokeObjectURL(track.url);
    }
  }
}

function playTrack(trackId) {
  const track = tracks.find((item) => item.id === trackId);

  if (!track) {
    return;
  }

  activeTrackId = track.id;
  audioPlayer.src = track.url;
  audioPlayer.play().catch(() => {
    setStatus("재생을 시작하려면 플레이 버튼을 눌러주세요.");
  });

  trackTitle.textContent = track.file.name;
  trackMeta.textContent = `${track.file.type || "오디오 파일"} · ${formatBytes(track.file.size)}`;
  setStatus("재생 중");
  renderPlaylist();
}

function playAdjacentTrack(direction) {
  if (tracks.length === 0) {
    setStatus("먼저 오디오 파일을 업로드해주세요.");
    return;
  }

  if (activeTrackId === null) {
    playTrack(tracks[0].id);
    return;
  }

  const activeIndex = getActiveIndex();
  const targetTrack = tracks[activeIndex + direction];

  if (!targetTrack) {
    setStatus(direction < 0 ? "첫 번째 곡입니다." : "마지막 곡입니다.");
    updateNavigationButtons();
    return;
  }

  playTrack(targetTrack.id);
}

function openDatabase() {
  if (!("indexedDB" in window)) {
    return Promise.resolve(null);
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

async function saveTrackToDatabase(track) {
  const db = await openDatabase();

  if (!db) {
    return;
  }

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    store.put({
      id: track.id,
      file: track.file,
    });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function getAllTracksFromDatabase() {
  const db = await openDatabase();

  if (!db) {
    return [];
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function clearDatabaseTracks() {
  const db = await openDatabase();

  if (!db) {
    return;
  }

  await new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    store.clear();

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function hydrateTracksFromDatabase() {
  try {
    const savedTracks = await getAllTracksFromDatabase();

    if (savedTracks.length === 0) {
      updateSummary();
      renderPlaylist();
      updateNavigationButtons();
      return;
    }

    revokeTrackUrls();
    tracks.length = 0;

    for (const savedTrack of savedTracks) {
      tracks.push({
        id: savedTrack.id,
        file: savedTrack.file,
        url: URL.createObjectURL(savedTrack.file),
      });
    }

    nextTrackId = Math.max(...tracks.map((track) => track.id)) + 1;
    sortTracks();
    updateSummary();
    resetPlayerDetails();
    setStatus(`${tracks.length}개 파일을 기기 저장소에서 불러왔습니다.`);
  } catch {
    setStatus("저장된 파일을 불러오지 못했습니다.");
  }
}

async function addFiles(fileList) {
  const audioFiles = Array.from(fileList).filter((file) => file.type.startsWith("audio/"));

  if (audioFiles.length === 0) {
    setStatus("오디오 파일만 업로드할 수 있습니다.");
    return;
  }

  const newTracks = audioFiles.map((file) => {
    const track = {
      id: nextTrackId,
      file,
      url: URL.createObjectURL(file),
    };

    nextTrackId += 1;
    return track;
  });

  tracks.push(...newTracks);

  try {
    for (const track of newTracks) {
      await saveTrackToDatabase(track);
    }
  } catch {
    setStatus("파일은 추가됐지만 기기 저장에는 실패했습니다.");
  }

  sortTracks();
  updateSummary();

  if (activeTrackId === null && tracks.length > 0) {
    playTrack(tracks[0].id);
  } else {
    setStatus(`${audioFiles.length}개 파일이 추가되고 기기에 저장되었습니다.`);
  }
}

async function clearTracks() {
  revokeTrackUrls();
  tracks.length = 0;
  activeTrackId = null;
  audioPlayer.pause();
  audioPlayer.removeAttribute("src");
  audioPlayer.load();

  try {
    await clearDatabaseTracks();
    setStatus("목록과 저장된 파일을 모두 비웠습니다.");
  } catch {
    setStatus("화면 목록은 비웠지만 저장소 정리에 실패했습니다.");
  }

  resetPlayerDetails();
  updateSummary();
  renderPlaylist();
  updateNavigationButtons();
}

audioInput.addEventListener("change", async (event) => {
  await addFiles(event.target.files);
  audioInput.value = "";
});

["dragenter", "dragover"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.add("is-dragover");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove("is-dragover");
  });
});

dropzone.addEventListener("drop", async (event) => {
  await addFiles(event.dataTransfer.files);
});

playFirstButton.addEventListener("click", () => {
  if (tracks.length === 0) {
    setStatus("먼저 오디오 파일을 업로드해주세요.");
    return;
  }

  playTrack(tracks[0].id);
});

sortButton.addEventListener("click", () => {
  if (tracks.length === 0) {
    setStatus("정렬할 파일이 없습니다.");
    return;
  }

  sortTracks();
  setStatus("파일 이름 기준으로 순서를 정리했습니다.");
});

previousButton.addEventListener("click", () => {
  playAdjacentTrack(-1);
});

nextButton.addEventListener("click", () => {
  playAdjacentTrack(1);
});

clearButton.addEventListener("click", async () => {
  await clearTracks();
});

audioPlayer.addEventListener("ended", () => {
  if (tracks.length === 0 || activeTrackId === null) {
    return;
  }

  const activeIndex = getActiveIndex();
  const nextTrack = tracks[activeIndex + 1];

  if (nextTrack) {
    playTrack(nextTrack.id);
  } else {
    setStatus("재생 완료");
    updateNavigationButtons();
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      setStatus("앱 설치용 준비 중 일부가 등록되지 않았습니다.");
    });
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.classList.remove("hidden");
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    setStatus("브라우저 메뉴에서 홈 화면에 추가를 사용해주세요.");
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.classList.add("hidden");
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installButton.classList.add("hidden");
  setStatus("앱이 설치되었습니다.");
});

updateSummary();
renderPlaylist();
updateNavigationButtons();
resetPlayerDetails();
hydrateTracksFromDatabase();
