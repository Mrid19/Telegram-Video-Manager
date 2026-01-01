document.addEventListener('DOMContentLoaded', async () => {
  const listBody = document.getElementById('video-list');
  const table = document.getElementById('video-table');
  const statusDiv = document.getElementById('status');
  const clearBtn = document.getElementById('clear-btn');
  const donateBtn = document.getElementById('donate-btn');

  // Donation Link
  if(donateBtn) {
      donateBtn.onclick = () => { chrome.tabs.create({ url: "https://buymeacoffee.com/mridul19" }); };
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url.includes("web.telegram.org")) {
    statusDiv.innerText = "Please open Telegram Web first.";
    return;
  }

  clearBtn.onclick = () => {
    chrome.tabs.sendMessage(tab.id, { action: "CLEAR_MEMORY" });
    listBody.innerHTML = "";
    table.style.display = "none";
    statusDiv.style.display = "block";
    statusDiv.innerText = "List cleared.";
  };

  chrome.tabs.sendMessage(tab.id, { action: "GET_VIDEOS" }, (response) => {
    if (!response || !response.videos || response.videos.length === 0) {
      statusDiv.innerText = "No videos detected yet. Play a video!";
      return;
    }

    statusDiv.style.display = "none";
    table.style.display = "table";
    listBody.innerHTML = ""; 

    // Get the maps
    const videos = response.videos;
    const meta = response.meta || {};

    videos.forEach((videoUrl, index) => {
      let displayName = `Video_${index + 1}.mp4`;
      let displaySize = "--";
      
      // Get Duration from the metadata map we made in content.js
      let displayTime = meta[videoUrl] || "--:--";

      try {
        const decoded = decodeURIComponent(videoUrl);
        const nameMatch = decoded.match(/"fileName"\s*:\s*"([^"]+)"/);
        if (nameMatch && nameMatch[1]) displayName = nameMatch[1];
        
        const sizeMatch = decoded.match(/"size"\s*:\s*(\d+)/);
        if (sizeMatch && sizeMatch[1]) {
            displaySize = (parseInt(sizeMatch[1]) / 1024 / 1024).toFixed(1) + " MB";
        }
      } catch (e) {}

      const row = document.createElement('tr');
      row.innerHTML = `
        <td class="col-idx">${index + 1}</td>
        <td><span class="filename" title="${displayName}">${displayName}</span></td>
        <td class="col-time">${displayTime}</td> <td class="col-size">${displaySize}</td>
        <td class="col-act"><button class="btn-download" title="Download">⬇</button></td>
      `;

      const btn = row.querySelector('.btn-download');
      btn.onclick = () => {
        btn.style.backgroundColor = "#4caf50";
        btn.innerText = "✔";
        btn.disabled = true;
        chrome.tabs.sendMessage(tab.id, { action: "START_DOWNLOAD", url: videoUrl });
      };

      listBody.appendChild(row);
    });
  });
});