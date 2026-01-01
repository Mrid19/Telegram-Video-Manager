console.log("🚀 Telegram Bridge Loaded");

const s = document.createElement('script');
s.src = chrome.runtime.getURL('logic.js');
s.onload = function() { this.remove(); };
(document.head || document.documentElement).appendChild(s);

// Store detected videos AND their metadata
let detectedVideos = new Set();
let videoMetaData = {}; // Maps URL -> Duration string (e.g. "12:30")

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data.type === "TELEGRAM_VIDEO_FOUND") {
    const url = event.data.url;
    
    // 1. Save the URL
    detectedVideos.add(url);
    
    // 2. Try to grab Duration from the active player
    // We look for any video element that is ready to play
    const videoElement = document.querySelector('video');
    if (videoElement && !isNaN(videoElement.duration)) {
        const sec = videoElement.duration;
        videoMetaData[url] = formatDuration(sec);
    } else {
        videoMetaData[url] = "--:--";
    }
  }
});

// Helper: Convert seconds to "MM:SS" or "HH:MM:SS"
function formatDuration(seconds) {
    if(!seconds) return "--:--";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    const mDisplay = m < 10 ? "0" + m : m;
    const sDisplay = s < 10 ? "0" + s : s;
    
    if (h > 0) return `${h}:${mDisplay}:${sDisplay}`;
    return `${mDisplay}:${sDisplay}`;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Return BOTH the list of URLs and the Duration map
  if (request.action === "GET_VIDEOS") {
    sendResponse({ 
        videos: Array.from(detectedVideos),
        meta: videoMetaData 
    });
  }
  
  if (request.action === "CLEAR_MEMORY") {
    detectedVideos.clear();
    videoMetaData = {};
    console.log("🧹 Memory cleared.");
  }
  
  if (request.action === "START_DOWNLOAD") {
    window.postMessage({ type: "CMD_DOWNLOAD", url: request.url }, "*");
  }
});