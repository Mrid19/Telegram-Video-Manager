console.log("🔵 LOGIC LOADED: Central Download Manager");

const script = document.createElement('script');
script.src = "https://cdn.jsdelivr.net/npm/streamsaver@2.0.6/StreamSaver.min.js";
document.head.appendChild(script);

const seenUrls = new Set();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// --- 1. THE SPY (Detects Links) ---
const observer = new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    const url = entry.name;
    if ((url.includes("/stream/") || url.includes("mimeType=video")) && !seenUrls.has(url)) {
      seenUrls.add(url);
      window.postMessage({ type: "TELEGRAM_VIDEO_FOUND", url: url }, "*");
    }
  });
});
observer.observe({ entryTypes: ["resource"] });

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data.type === "CMD_DOWNLOAD") {
    downloadInChunks(event.data.url);
  }
});

// --- 2. UI MANAGER (The Central Panel) ---
const DownloadManager = {
    box: null,
    listContainer: null,
    headerTitle: null,
    isMinimized: false,
    activeCount: 0,

    init() {
        if (this.box) return; // Already exists

        // Main Container
        this.box = document.createElement("div");
        this.box.style.cssText = "position:fixed; bottom:20px; right:20px; width:340px; background:#1e1e1e; border:1px solid #333; border-radius:8px; box-shadow:0 10px 30px rgba(0,0,0,0.7); z-index:999999; font-family:'Segoe UI', sans-serif; color:white; overflow:hidden; transition: height 0.3s;";
        
        // Header
        const header = document.createElement("div");
        header.style.cssText = "background:#2d2d2d; padding:10px 15px; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center; cursor:pointer;";
        
        this.headerTitle = document.createElement("div");
        this.headerTitle.innerText = "Downloads (0)";
        this.headerTitle.style.fontWeight = "bold";
        this.headerTitle.style.fontSize = "13px";
        
        const minBtn = document.createElement("div");
        minBtn.innerHTML = "&minus;";
        minBtn.style.cssText = "font-size:20px; color:#aaa; line-height:10px;";
        
        header.appendChild(this.headerTitle);
        header.appendChild(minBtn);
        this.box.appendChild(header);

        // List Area
        this.listContainer = document.createElement("div");
        this.listContainer.style.cssText = "max-height:300px; overflow-y:auto; scrollbar-width:thin;";
        this.box.appendChild(this.listContainer);

        document.body.appendChild(this.box);

        // Minimize Logic
        header.onclick = () => {
            this.isMinimized = !this.isMinimized;
            if (this.isMinimized) {
                this.listContainer.style.display = "none";
                minBtn.innerHTML = "+"; // Plus sign
            } else {
                this.listContainer.style.display = "block";
                minBtn.innerHTML = "&minus;";
            }
        };
    },

    addDownloadRow(filename, controls) {
        this.init();
        this.activeCount++;
        this.headerTitle.innerText = `Downloads (${this.activeCount})`;
        
        // Row Container
        const row = document.createElement("div");
        row.style.cssText = "padding:12px; border-bottom:1px solid #333; background:#1e1e1e;";
        
        // Top Line: Filename
        const title = document.createElement("div");
        title.innerText = filename.length > 35 ? filename.substring(0, 32) + "..." : filename;
        title.title = filename;
        title.style.cssText = "font-size:12px; margin-bottom:8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:500;";
        
        // Middle Line: Progress Bar
        const progressBg = document.createElement("div");
        progressBg.style.cssText = "width:100%; height:6px; background:#333; border-radius:3px; overflow:hidden; margin-bottom:8px;";
        const progressBar = document.createElement("div");
        progressBar.style.cssText = "width:0%; height:100%; background:#0099ff; transition:width 0.2s;";
        progressBg.appendChild(progressBar);

        // Bottom Line: Stats + Controls
        const bottomRow = document.createElement("div");
        bottomRow.style.cssText = "display:flex; justify-content:space-between; align-items:center;";

        const statusText = document.createElement("div");
        statusText.innerText = "Starting...";
        statusText.style.cssText = "font-size:10px; color:#aaa; width:120px;";

        const btnGroup = document.createElement("div");
        btnGroup.style.cssText = "display:flex; gap:5px;";

        // Helper to create mini buttons
        const createBtn = (icon, color, action) => {
            const b = document.createElement("button");
            b.innerHTML = icon;
            b.style.cssText = `background:none; border:1px solid #444; color:${color}; border-radius:3px; cursor:pointer; padding:2px 8px; font-size:11px;`;
            b.onclick = action;
            return b;
        };

        const pauseBtn = createBtn("⏸", "#fff", () => {
            controls.paused = !controls.paused;
            if (controls.paused) {
                pauseBtn.innerHTML = "▶";
                pauseBtn.style.color = "#00ff00"; // Green play button
                statusText.innerText = "Paused";
            } else {
                pauseBtn.innerHTML = "⏸";
                pauseBtn.style.color = "#fff";
                statusText.innerText = "Resuming...";
            }
        });

        const cancelBtn = createBtn("✖", "#ff4444", () => {
            if(confirm("Cancel this download?")) {
                controls.cancelled = true;
                row.style.opacity = "0.5";
                statusText.innerText = "Cancelling...";
            }
        });

        btnGroup.appendChild(pauseBtn);
        btnGroup.appendChild(cancelBtn);
        bottomRow.appendChild(statusText);
        bottomRow.appendChild(btnGroup);

        row.appendChild(title);
        row.appendChild(progressBg);
        row.appendChild(bottomRow);
        this.listContainer.prepend(row); // Add new downloads to top

        // Return the updater object
        return {
            update(percent, speed, eta) {
                progressBar.style.width = percent + "%";
                statusText.innerText = `${percent}% · ${speed} MB/s`;
                title.title = `${filename} (ETA: ${eta})`;
            },
            complete() {
                progressBar.style.background = "#00cc66";
                statusText.innerText = "✅ Complete";
                pauseBtn.remove();
                cancelBtn.innerHTML = "🗑"; // Turn cancel into delete row
                cancelBtn.onclick = () => {
                    row.remove();
                    DownloadManager.activeCount--;
                    DownloadManager.headerTitle.innerText = `Downloads (${DownloadManager.activeCount})`;
                };
            },
            error(msg) {
                progressBar.style.background = "#ff4444";
                statusText.innerText = "❌ Error: " + msg;
            }
        };
    }
};

// --- 3. DOWNLOAD LOGIC (With Multi-Thread Support) ---
async function downloadInChunks(url) {
    let filename = "Telegram_Video.mp4";
    try {
        const decoded = decodeURIComponent(url);
        const match = decoded.match(/"fileName"\s*:\s*"([^"]+)"/);
        if (match && match[1]) filename = match[1];
    } catch(e) {}

    // Pass control hooks
    const controls = { paused: false, cancelled: false };
    const ui = DownloadManager.addDownloadRow(filename, controls);
    
    try {
        const fileStream = streamSaver.createWriteStream(filename);
        const writer = fileStream.getWriter();
        let startByte = 0;
        let totalSize = 0;
        
        let startTime = Date.now();
        let lastTime = startTime;
        let lastLoaded = 0;
        let loadedTotal = 0;

        try {
            const probe = await fetch(url, { headers: { 'Range': 'bytes=0-1' } });
            const range = probe.headers.get('Content-Range');
            if (range) totalSize = parseInt(range.split('/')[1]);
        } catch(e) {}

        while (true) {
            if (controls.cancelled) { writer.abort("Cancelled"); ui.error("Cancelled"); return; }
            
            while (controls.paused) {
                if (controls.cancelled) { writer.abort(); ui.error("Cancelled"); return; }
                await sleep(500);
            }

            let success = false;
            let retryCount = 0;

            while(!success && retryCount < 5) {
                try {
                    if (controls.paused || controls.cancelled) break;
                    if (startByte > 0) await sleep(1200); 

                    const response = await fetch(url, { headers: { 'Range': `bytes=${startByte}-` } });
                    
                    if (!response.ok && response.status !== 206) {
                        if (response.status === 429) { await sleep(15000); throw new Error("Rate Limited"); }
                        throw new Error(`Status ${response.status}`);
                    }

                    const reader = response.body.getReader();
                    
                    while (true) {
                        if (controls.cancelled) { reader.cancel(); writer.abort(); ui.error("Cancelled"); return; }
                        if (controls.paused) { reader.cancel(); break; }

                        const { done, value } = await reader.read();
                        if (done) break;
                        await writer.write(value);
                        
                        loadedTotal += value.length;
                        const now = Date.now();
                        
                        if (now - lastTime > 1000) {
                            const duration = (now - lastTime) / 1000;
                            const bytesDiff = loadedTotal - lastLoaded;
                            const speed = (bytesDiff / duration / 1024 / 1024).toFixed(2);
                            const percent = totalSize > 0 ? ((loadedTotal / totalSize) * 100).toFixed(1) : 0;
                            
                            // Calculate ETA
                            let etaText = "";
                            if (totalSize > 0) {
                                const remaining = totalSize - loadedTotal;
                                const secLeft = remaining / (bytesDiff / duration);
                                etaText = secLeft < 60 ? `${secLeft.toFixed(0)}s` : `${(secLeft/60).toFixed(0)}m`;
                            }

                            ui.update(percent, speed, etaText);
                            lastTime = now;
                            lastLoaded = loadedTotal;
                        }
                    }
                    
                    if (controls.paused) break;

                    startByte += loadedTotal - startByte;

                    const contentRange = response.headers.get('Content-Range'); 
                    if (contentRange) {
                        const total = parseInt(contentRange.split('/')[1]);
                        if (startByte >= total) {
                             writer.close();
                             ui.complete();
                             return;
                        }
                    } else if (loadedTotal - startByte === 0) {
                         writer.close();
                         ui.complete();
                         return;
                    }
                    success = true;

                } catch (err) {
                    if (controls.cancelled) return;
                    retryCount++;
                    await sleep(3000 * retryCount);
                }
            }
        }
    } catch (err) {
        if (!controls.cancelled) ui.error(err.message);
    }
}