                        extractedText = data.text;
                    }
                    
                    switchTab('manual');
                    document.getElementById('lyricsChords').value = extractedText;
                    
                    alert('Text extracted! Chords should be positioned correctly. Please review before saving.');
                }).catch(err => {
                    console.error('OCR Error:', err);
                    document.getElementById('processingText').textContent = 'Error processing image. Please try manual entry.';
                    document.getElementById('processingText').style.color = '#f56565';
                });
            };
            reader.readAsDataURL(file);
        }

        function saveSong() {
            const title = document.getElementById('songTitle').value.trim();
            const artist = document.getElementById('artistName').value.trim();
            const lyrics = document.getElementById('lyricsChords').value.trim();
            
            if (!title || !artist || !lyrics) {
                alert('Please fill in Song Title, Artist, and Lyrics with Chords');
                return;
            }
            
            const song = {
                id: appState.editingId || Date.now().toString(),
                category: appState.currentCategory,
                title,
                artist,
                albumArt: appState.currentAlbumArtData || '',
                capo: parseInt(document.getElementById('capoPosition').value),
                youtube: document.getElementById('youtubeUrl').value.trim(),
                lyrics
            };
            
            if (appState.editingId) {
                const index = appState.songs.findIndex(s => s.id === appState.editingId);
                appState.songs[index] = song;
            } else {
                appState.songs.push(song);
            }
            
            saveSongs();
            closeModal();
            
            if (appState.editingId) {
                openSong(song);
            } else {
                displaySongs();
            }
        }

        function deleteCurrentSong() {
            if (!confirm('Are you sure you want to delete this song?')) return;
            
            appState.songs = appState.songs.filter(s => s.id !== appState.currentSong.id);
            saveSongs();
            closeSongView();
            displaySongs();
        }

        function openTuner() {
            document.getElementById('tunerModal').classList.add('active');
            if (!appState.audioContext) {
                setupAudioContext();
            }
        }

        function closeTuner() {
            document.getElementById('tunerModal').classList.remove('active');
            stopTuner();
        }

        async function setupAudioContext() {
            try {
                appState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                appState.analyser = appState.audioContext.createAnalyser();
                appState.analyser.fftSize = 4096;
            } catch (err) {
                console.error('Audio context error:', err);
                alert('Unable to access audio. Please check your browser permissions.');
            }
        }

        async function selectString(note, frequency, element) {
            document.querySelectorAll('.tuning-peg').forEach(btn => btn.classList.remove('active'));
            element.classList.add('active');
            
            appState.selectedString = note;
            appState.targetFrequency = frequency;
            document.getElementById('tunerCurrentNote').textContent = note;
            document.getElementById('tunerInstruction').textContent = 'Listening...';
            document.getElementById('tunerInstruction').style.color = '#ff6b35';
            
            if (!appState.audioContext) {
                await setupAudioContext();
            }
            
            if (appState.audioContext.state === 'suspended') {
                await appState.audioContext.resume();
            }
            
            if (appState.mediaStream) {
                appState.mediaStream.getTracks().forEach(track => track.stop());
            }
            
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: {
                        echoCancellation: false,
                        autoGainControl: false,
                        noiseSuppression: false
                    } 
                });
                
                appState.mediaStream = stream;
                const source = appState.audioContext.createMediaStreamSource(stream);
                source.connect(appState.analyser);
                
                appState.tunerActive = true;
                updateTuner();
            } catch (err) {
                console.error('Microphone error:', err);
                document.getElementById('tunerInstruction').textContent = 'Microphone access denied';
                document.getElementById('tunerInstruction').style.color = '#f56565';
                alert('Unable to access microphone. Please allow microphone access in your browser settings.');
            }
        }

        function updateTuner() {
            if (!appState.tunerActive) return;
            
            const bufferLength = appState.analyser.fftSize;
            const buffer = new Float32Array(bufferLength);
            appState.analyser.getFloatTimeDomainData(buffer);
            
            let rms = 0;
            for (let i = 0; i < bufferLength; i++) {
                rms += buffer[i] * buffer[i];
            }
            rms = Math.sqrt(rms / bufferLength);
            
            if (rms > 0.01) {
                const frequency = autoCorrelate(buffer, appState.audioContext.sampleRate);
                
                if (frequency > 0 && appState.targetFrequency) {
                    const cents = 1200 * Math.log2(frequency / appState.targetFrequency);
                    
                    if (Math.abs(cents) < 1200) {
                        updateTunerDisplay(cents, frequency);
                    }
                }
            }
            
            requestAnimationFrame(updateTuner);
        }

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
            'C': { fingers: [0, 3, 2, 0, 1, 0], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'D': { fingers: [-1, -1, 0, 2, 3, 2], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'E': { fingers: [0, 2, 2, 1, 0, 0], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'F': { fingers: [1, 3, 3, 2, 1, 1], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'G': { fingers: [3, 2, 0, 0, 0, 3], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'A': { fingers: [-1, 0, 2, 2, 2, 0], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'B': { fingers: [-1, 2, 4, 4, 4, 2], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'Am': { fingers: [-1, 0, 2, 2, 1, 0], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'Dm': { fingers: [-1, -1, 0, 2, 3, 1], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'Em': { fingers: [0, 2, 2, 0, 0, 0], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'Fm': { fingers: [1, 3, 3, 1, 1, 1], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'Gm': { fingers: [3, 5, 5, 3, 3, 3], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'Bm': { fingers: [-1, 2, 4, 4, 3, 2], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'G7': { fingers: [3, 2, 0, 0, 0, 1], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'C7': { fingers: [0, 3, 2, 3, 1, 0], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'D7': { fingers: [-1, -1, 0, 2, 1, 2], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'E7': { fingers: [0, 2, 0, 1, 0, 0], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'A7': { fingers: [-1, 0, 2, 0, 2, 0], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'B7': { fingers: [-1, 2, 1, 2, 0, 2], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'F#m': { fingers: [2, 4, 4, 2, 2, 2], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'Cmaj7': { fingers: [0, 3, 2, 0, 0, 0], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'Dmaj7': { fingers: [-1, -1, 0, 2, 2, 2], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'Emaj7': { fingers: [0, 2, 1, 1, 0, 0], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'Fmaj7': { fingers: [1, 3, 2, 2, 1, 0], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'Gmaj7': { fingers: [3, 2, 0, 0, 0, 2], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'Amaj7': { fingers: [-1, 0, 2, 1, 2, 0], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'Amin7': { fingers: [-1, 0, 2, 0, 1, 0], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'Dmin7': { fingers: [-1, -1, 0, 2, 1, 1], strum: '↓ ↓ ↑ ↑ ↓ ↑' },
            'Emin7': { fingers: [0, 2, 0, 0, 0, 0], strum: '↓ ↓ ↑ ↑ ↓ ↑' }
        };

        function showChordDiagram(chord) {
            const modal = document.getElementById('chordDiagramModal');
            const title = document.getElementById('chordDiagramTitle');
            const svg = document.getElementById('chordDiagramSvg');
            
            const baseChord = chord.replace(/[0-9]|sus|add|maj|min|dim|aug/g, '').trim();
            
            if (chordDiagrams[baseChord]) {
                title.textContent = chord;
                svg.innerHTML = drawChordDiagram(chordDiagrams[baseChord].fingers);
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
            
            // Chord lines are NOT clickable - only the chord tags in the list are
            // This prevents the highlighting/cursor issue on chord lines
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
                    <button onclick="addSongToPlaylist('${playlist.id}')" style="padding:8px 15px;background:#48bb78;color:white;border:none;border-radius:6px;cursor:pointer;margin-right:10px;">+ Add Song</button>
                    <button onclick="viewPlaylist('${playlist.id}')" style="padding:8px 15px;background:#667eea;color:white;border:none;border-radius:6px;cursor:pointer;margin-right:10px;">View Songs</button>
                    <button onclick="deletePlaylist('${playlist.id}')" style="padding:8px 15px;background:#f56565;color:white;border:none;border-radius:6px;cursor:pointer;">Delete</button>
                `;
                container.appendChild(div);
            });
        }

        function addSongToPlaylist(playlistId) {
            const songTitle = prompt('Enter song title to add (must match exactly):');
            if (!songTitle) return;
            
            const song = appState.songs.find(s => s.title.toLowerCase() === songTitle.toLowerCase());
            if (!song) {
                alert('Song not found. Please check the spelling.');
                return;
            }
            
            const playlist = appState.playlists.find(p => p.id === playlistId);
            if (!playlist.songs.includes(song.id)) {
                playlist.songs.push(song.id);
                savePlaylists();
                displayPlaylists();
                alert('Song added to playlist!');
            } else {
                alert('Song already in playlist!');
            }
        }

        function viewPlaylist(id) {
            const playlist = appState.playlists.find(s => s.id === id);
            if (playlist) {
                const songTitles = playlist.songs.map(songId => {
                    const song = appState.songs.find(s => s.id === songId);
                    return song ? song.title : 'Unknown';
                }).join('\n');
                alert(`Playlist: ${playlist.name}\n\n${playlist.songs.length} songs:\n\n${songTitles}`);
            }
        }

        // Recently Played Functions
        function addToRecentlyPlayed(song) {
            // Remove if already in list
            appState.recentlyPlayed = appState.recentlyPlayed.filter(s => s.id !== song.id);
            // Add to front
            appState.recentlyPlayed.unshift(song);
            // Keep only last 10
            if (appState.recentlyPlayed.length > 10) {
                appState.recentlyPlayed = appState.recentlyPlayed.slice(0, 10);
            }
            localStorage.setItem('recentlyPlayed', JSON.stringify(appState.recentlyPlayed));
        }

        function loadRecentlyPlayed() {
            const stored = localStorage.getItem('recentlyPlayed');
            if (stored) {
                appState.recentlyPlayed = JSON.parse(stored);
