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
const playFirstButton = document.getElementById("play-first-button");
const clearButton = document.getElementById("clear-button");

const tracks = [];
let activeTrackId = null;
let nextTrackId = 1;

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

function getActiveIndex() {
  return tracks.findIndex((track) => track.id === activeTrackId);
}

function updateNavigationButtons() {
  const activeIndex = getActiveIndex();
  const hasTracks = tracks.length > 0;

  previousButton.disabled = !hasTracks || activeIndex <= 0;
  nextButton.disabled = !hasTracks || activeIndex === -1 || activeIndex >= tracks.length - 1;
}

function renderPlaylist() {
  playlist.innerHTML = "";

  if (tracks.length === 0) {
    const emptyState = document.createElement("li");
    emptyState.className = "empty-state";
    emptyState.textContent = "업로드한 파일이 여기에 표시됩니다.";
    playlist.appendChild(emptyState);
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

function addFiles(fileList) {
  const audioFiles = Array.from(fileList).filter((file) => file.type.startsWith("audio/"));

  if (audioFiles.length === 0) {
    setStatus("오디오 파일만 업로드할 수 있습니다.");
    return;
  }

  for (const file of audioFiles) {
    tracks.push({
      id: nextTrackId,
      file,
      url: URL.createObjectURL(file),
    });
    nextTrackId += 1;
  }

  updateSummary();
  renderPlaylist();
  setStatus(`${audioFiles.length}개 파일이 추가되었습니다.`);

  if (activeTrackId === null && tracks.length > 0) {
    playTrack(tracks[0].id);
  }
}

function clearTracks() {
  for (const track of tracks) {
    URL.revokeObjectURL(track.url);
  }

  tracks.length = 0;
  activeTrackId = null;
  audioPlayer.pause();
  audioPlayer.removeAttribute("src");
  audioPlayer.load();

  trackTitle.textContent = "재생할 파일을 선택하세요";
  trackMeta.textContent = "아직 업로드된 오디오가 없습니다.";
  setStatus("목록이 비워졌습니다.");
  updateSummary();
  renderPlaylist();
  updateNavigationButtons();
}

audioInput.addEventListener("change", (event) => {
  addFiles(event.target.files);
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

dropzone.addEventListener("drop", (event) => {
  addFiles(event.dataTransfer.files);
});

playFirstButton.addEventListener("click", () => {
  if (tracks.length === 0) {
    setStatus("먼저 오디오 파일을 업로드해주세요.");
    return;
  }

  playTrack(tracks[0].id);
});

previousButton.addEventListener("click", () => {
  playAdjacentTrack(-1);
});

nextButton.addEventListener("click", () => {
  playAdjacentTrack(1);
});

clearButton.addEventListener("click", () => {
  clearTracks();
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

updateSummary();
renderPlaylist();
updateNavigationButtons();
