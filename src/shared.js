// Constants
export const dataUrl = "https://worldrecords.bambitp.workers.dev";

// Helper functions for player names
export function getLeaderboardPlayerKey(player) {
  if (/^Some Ball(?:\s*\d+)?$/i.test(player.name)) {
    return "Some Balls";
  }
  return player.user_id ? player.user_id : player.name;
}

export function getLeaderboardPlayerDisplayName(player) {
  if (/^Some Ball(?:\s*\d+)?$/i.test(player.name)) {
    return "Some Balls";
  }
  return player.name;
}

export function getMapsPlayerKey(player) {
  return player.user_id ? player.user_id : player.name;
}

export function getMapsPlayerDisplayName(player) {
  return player.name;
}

// Time formatting functions
export function formatTime(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;

  if (hours > 0) {
    const minutesStr = minutes.toString().padStart(2, '0');
    const secondsStr = seconds.toString().padStart(2, '0');
    const millisStr = milliseconds.toString().padStart(3, '0');
    return `${hours}:${minutesStr}:${secondsStr}.${millisStr}`;
  } else if (minutes > 0) {
    const secondsStr = seconds.toString().padStart(2, '0');
    const millisStr = milliseconds.toString().padStart(3, '0');
    return `${minutes}:${secondsStr}.${millisStr}`;
  } else {
    const millisStr = milliseconds.toString().padStart(3, '0');
    return `${seconds}.${millisStr}`;
  }
}

export function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - new Date(timestamp).getTime();
  const days = Math.floor(diff / (24 * 3600000));

  if (days < 1) {
    const hours = Math.floor(diff / 3600000);
    if (hours > 0) {
      return `${hours} hours ago`;
    } else {
      const minutes = Math.floor(diff / 60000);
      return minutes > 0 ? `${minutes} minutes ago` : "just now";
    }
  } else if (days < 7) {
    const hours = Math.floor((diff % (24 * 3600000)) / 3600000);
    return `${days} days ${hours} hours ago`;
  } else if (days < 30) {
    const weeks = Math.floor(days / 7);
    const remDays = days % 7;
    return `${weeks} week${weeks !== 1 ? "s" : ""} ${remDays} day${remDays !== 1 ? "s" : ""} ago`;
  } else if (days < 365) {
    const months = Math.floor(days / 30);
    const remDays = days % 30;
    return `${months} month${months !== 1 ? "s" : ""} ${remDays} day${remDays !== 1 ? "s" : ""} ago`;
  } else {
    const years = Math.floor(days / 365);
    const remDays = days % 365;
    const months = Math.floor(remDays / 30);
    return `${years} year${years !== 1 ? "s" : ""} ${months} month${months !== 1 ? "s" : ""} ago`;
  }
}

// Navigation functions
export function setupNavigation() {
  const speedRecordsLink = document.getElementById('speedRecordsLink');
  const jumpRecordsLink = document.getElementById('jumpRecordsLink');
  const leaderboardLink = document.getElementById('leaderboardLink');
  const gltpLink = document.getElementById('gltpLink');

  const speedBanner = document.getElementById("speedBanner");
  const jumpBanner = document.getElementById("jumpBanner");

  // Default page
  let activePage = "mapsRecordsContainer";

  function showPage(page) {
    document.getElementById("mapsRecordsContainer").style.display = page === "mapsRecordsContainer" ? "flex" : "none";
    document.getElementById("jumpsRecordsContainer").style.display = page === "jumpRecordsContainer" ? "flex" : "none";
    document.getElementById("leaderboardPage").style.display = page === "leaderboardPage" ? "block" : "none";

    // Toggle nav link active states
    speedRecordsLink.classList.toggle("active", page === "mapsRecordsContainer");
    jumpRecordsLink.classList.toggle("active", page === "jumpRecordsContainer");
    leaderboardLink.classList.toggle("active", page === "leaderboardPage");

    // Toggle info banners
    speedBanner.style.display = page === "mapsRecordsContainer" ? "block" : "none";
    jumpBanner.style.display = page === "jumpRecordsContainer" ? "block" : "none";

    // Update state
    activePage = page;
  }

  // Event listeners
  speedRecordsLink.addEventListener("click", () => showPage("mapsRecordsContainer"));
  jumpRecordsLink.addEventListener("click", () => showPage("jumpRecordsContainer"));
  leaderboardLink.addEventListener("click", () => showPage("leaderboardPage"));
  gltpLink.addEventListener("click", () => (window.location.href = "S2/home.html"));

  // Initialize to default
  showPage(activePage);
}


// TagPro group launch function
export function launchTagproGroup(preset) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = "https://tagpro.koalabeast.com/groups/create";
  form.target = "_blank";

  const nameInput = document.createElement("input");
  nameInput.type = "hidden";
  nameInput.name = "name";
  nameInput.value = "GLTP IS THE BEST";

  const privateInput = document.createElement("input");
  privateInput.type = "hidden";
  privateInput.name = "private";
  privateInput.value = "on";

  const presetInput = document.createElement("input");
  presetInput.type = "hidden";
  presetInput.name = "preset";
  presetInput.value = preset;

  form.appendChild(nameInput);
  form.appendChild(privateInput);
  form.appendChild(presetInput);

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
} 