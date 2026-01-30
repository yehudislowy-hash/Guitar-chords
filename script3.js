
        function autoCorrelate(buffer, sampleRate) {
            const threshold = 0.1;
            const bufferSize = buffer.length;
            const yinBuffer = new Float32Array(bufferSize / 2);
            
            yinBuffer[0] = 1;
            let runningSum = 0;
            
            for (let tau = 1; tau < yinBuffer.length; tau++) {
                let sum = 0;
                for (let i = 0; i < yinBuffer.length; i++) {
                    const delta = buffer[i] - buffer[i + tau];
                    sum += delta * delta;
                }
                yinBuffer[tau] = sum;
            }
            
            for (let tau = 1; tau < yinBuffer.length; tau++) {
                runningSum += yinBuffer[tau];
                yinBuffer[tau] *= tau / runningSum;
            }
            
            let tau = 2;
            while (tau < yinBuffer.length) {
                if (yinBuffer[tau] < threshold) {
                    while (tau + 1 < yinBuffer.length && yinBuffer[tau + 1] < yinBuffer[tau]) {
                        tau++;
                    }
                    break;
                }
                tau++;
            }
            
            if (tau === yinBuffer.length || yinBuffer[tau] >= threshold) {
                return -1;
            }
            
            let betterTau;
            const x0 = (tau < 1) ? tau : tau - 1;
            const x2 = (tau + 1 < yinBuffer.length) ? tau + 1 : tau;
            
            if (x0 === tau) {
                betterTau = (yinBuffer[tau] <= yinBuffer[x2]) ? tau : x2;
            } else if (x2 === tau) {
                betterTau = (yinBuffer[tau] <= yinBuffer[x0]) ? tau : x0;
            } else {
                const s0 = yinBuffer[x0];
                const s1 = yinBuffer[tau];
                const s2 = yinBuffer[x2];
                betterTau = tau + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
            }
            
            return sampleRate / betterTau;
        }

        function updateTunerDisplay(cents, frequency) {
            const needleContainer = document.getElementById('needleContainer');
            const needleStick = document.getElementById('needleStick');
            const centsDisplay = document.getElementById('gaugeCentsDisplay');
            const instruction = document.getElementById('tunerInstruction');
            const frequencyDisplay = document.getElementById('tunerFrequency');
            
            frequencyDisplay.textContent = `${Math.round(frequency)} Hz`;
            
            const clampedCents = Math.max(-50, Math.min(50, cents));
            const position = 50 + clampedCents;
            
            needleContainer.style.left = `${position}%`;
            
            centsDisplay.style.display = 'block';
            centsDisplay.textContent = Math.round(Math.abs(cents));
            
            const now = Date.now();
            if (Math.abs(cents) < 5) {
                instruction.textContent = 'In Tune!';
                instruction.style.color = '#48bb78';
                needleStick.classList.add('in-tune');
                centsDisplay.style.background = '#48bb78';
                
                if (now - appState.lastTuneTime > 1000) {
                    playTone(appState.targetFrequency, 0.15, 0.2);
                    appState.lastTuneTime = now;
                }
            } else {
                needleStick.classList.remove('in-tune');
                
                if (cents < -5) {
                    instruction.textContent = 'Tune Up (Tighten)';
                    instruction.style.color = '#f56565';
                    centsDisplay.style.background = '#f56565';
                } else if (cents > 5) {
                    instruction.textContent = 'Tune Down (Loosen)';
                    instruction.style.color = '#ff8c42';
                    centsDisplay.style.background = '#ff8c42';
                }
            }
        }

        function playTone(frequency, duration, volume = 0.3) {
            const oscillator = appState.audioContext.createOscillator();
            const gainNode = appState.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(appState.audioContext.destination);
            
            oscillator.frequency.value = frequency;
            gainNode.gain.value = volume;
            
            oscillator.start();
            setTimeout(() => oscillator.stop(), duration * 1000);
        }

        function stopTuner() {
            appState.tunerActive = false;
            appState.selectedString = null;
            appState.targetFrequency = null;
            
            if (appState.mediaStream) {
                appState.mediaStream.getTracks().forEach(track => track.stop());
                appState.mediaStream = null;
            }
            
            document.getElementById('tunerInstruction').textContent = 'Select a string to tune';
            document.getElementById('tunerInstruction').style.color = '#ff6b35';
            document.getElementById('tunerCurrentNote').textContent = '-';
            document.getElementById('tunerFrequency').textContent = '- Hz';
            document.getElementById('gaugeCentsDisplay').style.display = 'none';
            
            const needleContainer = document.getElementById('needleContainer');
            const needleStick = document.getElementById('needleStick');
            needleContainer.style.left = '50%';
            needleStick.classList.remove('in-tune');
            
            document.querySelectorAll('.tuning-peg').forEach(btn => btn.classList.remove('active'));
        }

        function changeFont() {
            const font = document.getElementById('fontSelect').value;
            appState.selectedFont = font;
            document.getElementById('songContent').style.setProperty('--content-font', font);
            localStorage.setItem('selectedFont', font);
        }

        function loadFont() {
            const saved = localStorage.getItem('selectedFont');
            if (saved) {
                appState.selectedFont = saved;
                document.getElementById('fontSelect').value = saved;
                document.getElementById('songContent').style.setProperty('--content-font', saved);
            }
        }

        function setYouTubeSpeed(speed) {
            document.querySelectorAll('.speed-option').forEach(btn => btn.classList.remove('active'));
            event.target.classList.add('active');
            
            const iframe = document.getElementById('youtubePlayer');
            iframe.contentWindow.postMessage(JSON.stringify({
                event: 'command',
                func: 'setPlaybackRate',
                args: [speed]
            }), '*');
        }

        function updateSongCounter() {
            const filtered = appState.songs.filter(s => s.category === appState.currentCategory);
            const counter = document.getElementById('songCounter');
            if (counter) {
                counter.textContent = `${filtered.length} song${filtered.length !== 1 ? 's' : ''}`;
            }
        }

        const chordDiagrams = {
            'C': [0, 3, 2, 0, 1, 0],
            'D': [-1, -1, 0, 2, 3, 2],
            'E': [0, 2, 2, 1, 0, 0],
            'F': [1, 3, 3, 2, 1, 1],
            'G': [3, 2, 0, 0, 0, 3],
            'A': [-1, 0, 2, 2, 2, 0],
            'Am': [-1, 0, 2, 2, 1, 0],
            'Dm': [-1, -1, 0, 2, 3, 1],
            'Em': [0, 2, 2, 0, 0, 0],
            'G7': [3, 2, 0, 0, 0, 1],
            'C7': [0, 3, 2, 3, 1, 0],
            'D7': [-1, -1, 0, 2, 1, 2],
            'E7': [0, 2, 0, 1, 0, 0],
            'A7': [-1, 0, 2, 0, 2, 0],
            'Bm': [-1, 2, 4, 4, 3, 2],
            'F#m': [2, 4, 4, 2, 2, 2]
        };

        function showChordDiagram(chord) {
            const modal = document.getElementById('chordDiagramModal');
            const title = document.getElementById('chordDiagramTitle');
            const svg = document.getElementById('chordDiagramSvg');
            
            const baseChord = chord.replace(/[0-9]|sus|add|maj|min|dim|aug/g, '').trim();
            
            if (chordDiagrams[baseChord]) {
                title.textContent = chord;
                svg.innerHTML = drawChordDiagram(chordDiagrams[baseChord]);
                modal.classList.add('active');
                
                setTimeout(() => {
                    modal.classList.remove('active');
                }, 3000);
            }
        }

        function drawChordDiagram(positions) {
            let svg = '';
            const startX = 20;
            const startY = 40;
            const fretWidth = 30;
            const stringSpacing = 30;
            
            for (let i = 0; i < 6; i++) {
                svg += `<line x1="${startX + i * stringSpacing}" y1="${startY}" x2="${startX + i * stringSpacing}" y2="${startY + 120}" stroke="#2d3748" stroke-width="2"/>`;
            }
            
            for (let i = 0; i <= 4; i++) {
                svg += `<line x1="${startX}" y1="${startY + i * fretWidth}" x2="${startX + 150}" y2="${startY + i * fretWidth}" stroke="#2d3748" stroke-width="${i === 0 ? 4 : 2}"/>`;
            }
            
            positions.forEach((fret, string) => {
                if (fret === -1) {
                    svg += `<text x="${startX + string * stringSpacing - 5}" y="30" font-size="20" fill="#e53e3e" font-weight="bold">×</text>`;
                } else if (fret === 0) {
                    svg += `<circle cx="${startX + string * stringSpacing}" cy="25" r="8" fill="none" stroke="#48bb78" stroke-width="3"/>`;
                } else {
                    svg += `<circle cx="${startX + string * stringSpacing}" cy="${startY + (fret - 0.5) * fretWidth}" r="10" fill="#667eea"/>`;
                }
            });
            
            const strings = ['E', 'A', 'D', 'G', 'B', 'e'];
            strings.forEach((str, i) => {
                svg += `<text x="${startX + i * stringSpacing - 5}" y="220" font-size="14" fill="#718096" font-weight="bold">${str}</text>`;
            });
            
            return svg;
        }

        function makeChordSClickable() {
            const chordTags = document.querySelectorAll('.chord-tag');
            chordTags.forEach(tag => {
                tag.style.cursor = 'pointer';
                tag.onclick = () => showChordDiagram(tag.textContent);
            });
            
            const content = document.getElementById('songContent');
            const chordLines = content.querySelectorAll('.chord-line');
            chordLines.forEach(line => {
                line.style.cursor = 'pointer';
                line.onclick = (e) => {
                    const text = line.textContent;
                    const chordPattern = /\b([A-G](#|b)?)(m|maj|min|dim|aug|sus|add)?([0-9]?)\b/g;
                    let match;
                    while ((match = chordPattern.exec(text)) !== null) {
                        showChordDiagram(match[0]);
                        break;
                    }
                };
            });
        }

        function loadPlaylists() {
            const stored = localStorage.getItem('guitarChordsPlaylists');
            if (stored) {
                appState.playlists = JSON.parse(stored);
            }
        }

        function savePlaylists() {
            localStorage.setItem('guitarChordsPlaylists', JSON.stringify(appState.playlists));
        }

        function openPlaylistManager() {
            document.getElementById('playlistModal').classList.add('active');
            displayPlaylists();
        }

        function closePlaylistModal() {
            document.getElementById('playlistModal').classList.remove('active');
        }

        function createNewPlaylist() {
            const name = prompt('Enter playlist name:');
            if (name) {
                appState.playlists.push({
                    id: Date.now().toString(),
                    name,
                    songs: []
                });
                savePlaylists();
                displayPlaylists();
            }
        }

        function displayPlaylists() {
            const container = document.getElementById('playlistsList');
            container.innerHTML = '';
            
            if (appState.playlists.length === 0) {
                container.innerHTML = '<p style="color:#718096;padding:20px;">No playlists yet. Create one!</p>';
                return;
            }
            
            appState.playlists.forEach(playlist => {
                const div = document.createElement('div');
                div.style.cssText = 'background:#f7fafc;padding:15px;margin:10px 0;border-radius:10px;';
                div.innerHTML = `
                    <h3 style="color:#667eea;margin-bottom:10px;">${playlist.name}</h3>
                    <p style="color:#718096;margin-bottom:10px;">${playlist.songs.length} songs</p>
                    <button onclick="viewPlaylist('${playlist.id}')" style="padding:8px 15px;background:#667eea;color:white;border:none;border-radius:6px;cursor:pointer;margin-right:10px;">View</button>
                    <button onclick="deletePlaylist('${playlist.id}')" style="padding:8px 15px;background:#f56565;color:white;border:none;border-radius:6px;cursor:pointer;">Delete</button>
                `;
                container.appendChild(div);
            });
        }

        function deletePlaylist(id) {
            if (confirm('Delete this playlist?')) {
                appState.playlists = appState.playlists.filter(s => s.id !== id);
                savePlaylists();
                displayPlaylists();
            }
        }

        function viewPlaylist(id) {
            const playlist = appState.playlists.find(s => s.id === id);
            if (playlist) {
                alert(`Playlist: ${playlist.name}\n\n${playlist.songs.length} songs\n\n(Full playlist playback coming soon!)`);
            }
        }
    </script>
