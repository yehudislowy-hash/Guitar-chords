            }
        }

        function showRecentlyPlayed() {
            document.getElementById('recentModal').classList.add('active');
            const container = document.getElementById('recentSongsList');
            container.innerHTML = '';
            
            if (appState.recentlyPlayed.length === 0) {
                container.innerHTML = '<p style="color:#718096;padding:20px;text-align:center;">No recently played songs yet!</p>';
                return;
            }
            
            appState.recentlyPlayed.forEach(song => {
                container.appendChild(createSongItem(song));
            });
        }

        function closeRecentModal() {
            document.getElementById('recentModal').classList.remove('active');
        }

        // Settings Functions
        function openSettings() {
            document.getElementById('settingsModal').classList.add('active');
            loadSavedColors();
        }

        function closeSettings() {
            document.getElementById('settingsModal').classList.remove('active');
        }

        function updateColors() {
            const primary = document.getElementById('primaryColorPicker').value;
            const secondary = document.getElementById('secondaryColorPicker').value;
            const chord = document.getElementById('chordColorPicker').value;
            
            appState.primaryColor = primary;
            appState.secondaryColor = secondary;
            appState.chordColor = chord;
            
            document.documentElement.style.setProperty('--primary-color', primary);
            document.documentElement.style.setProperty('--secondary-color', secondary);
            document.documentElement.style.setProperty('--chord-color', chord);
            
            localStorage.setItem('primaryColor', primary);
            localStorage.setItem('secondaryColor', secondary);
            localStorage.setItem('chordColor', chord);
        }

        function toggleBoldChords() {
            const isChecked = document.getElementById('boldChordsToggle').checked;
            appState.boldChords = isChecked;
            document.documentElement.style.setProperty('--chord-weight', isChecked ? '900' : '700');
            localStorage.setItem('boldChords', isChecked);
        }

        function loadSavedColors() {
            const primary = localStorage.getItem('primaryColor') || '#667eea';
            const secondary = localStorage.getItem('secondaryColor') || '#764ba2';
            const chord = localStorage.getItem('chordColor') || '#e53e3e';
            const boldChords = localStorage.getItem('boldChords') === 'true';
            
            document.getElementById('primaryColorPicker').value = primary;
            document.getElementById('secondaryColorPicker').value = secondary;
            document.getElementById('chordColorPicker').value = chord;
            document.getElementById('boldChordsToggle').checked = boldChords;
            
            appState.primaryColor = primary;
            appState.secondaryColor = secondary;
            appState.chordColor = chord;
            appState.boldChords = boldChords;
            
            document.documentElement.style.setProperty('--primary-color', primary);
            document.documentElement.style.setProperty('--secondary-color', secondary);
            document.documentElement.style.setProperty('--chord-color', chord);
            document.documentElement.style.setProperty('--chord-weight', boldChords ? '900' : '700');
        }

        function resetColors() {
            document.getElementById('primaryColorPicker').value = '#667eea';
            document.getElementById('secondaryColorPicker').value = '#764ba2';
            document.getElementById('chordColorPicker').value = '#e53e3e';
            document.getElementById('boldChordsToggle').checked = false;
            updateColors();
            toggleBoldChords();
        }

        // Recording Functions
        let mediaRecorder;
        let audioChunks = [];

        function openRecordModal() {
            document.getElementById('recordModal').classList.add('active');
        }

        function closeRecordModal() {
            document.getElementById('recordModal').classList.remove('active');
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
        }

        async function toggleRecording() {
            const btn = document.getElementById('recordBtn');
            const status = document.getElementById('recordStatus');
            const playback = document.getElementById('recordPlayback');
            
            if (!mediaRecorder || mediaRecorder.state === 'inactive') {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];
                    
                    mediaRecorder.ondataavailable = (event) => {
                        audioChunks.push(event.data);
                    };
                    
                    mediaRecorder.onstop = () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        const audioUrl = URL.createObjectURL(audioBlob);
                        playback.src = audioUrl;
                        playback.style.display = 'block';
                        status.textContent = 'Recording saved! Click play to listen.';
                        btn.textContent = '🎙️ Start Recording';
                        btn.style.background = '#48bb78';
                    };
                    
                    mediaRecorder.start();
                    btn.textContent = '⏹️ Stop Recording';
                    btn.style.background = '#f56565';
                    status.textContent = 'Recording... 🔴';
                    playback.style.display = 'none';
                } catch (err) {
                    console.error('Recording error:', err);
                    alert('Unable to access microphone. Please allow microphone access.');
                }
            } else {
                mediaRecorder.stop();
            }
        }

        // Update openSong to add to recently played and show rhythm
        const originalOpenSongFunc = openSong;
        openSong = function(song) {
            originalOpenSongFunc(song);
            addToRecentlyPlayed(song);
            
            // Show rhythm if exists
            const rhythmEl = document.getElementById('viewRhythm');
            if (song.rhythm) {
                rhythmEl.textContent = `Rhythm: ${song.rhythm}`;
                rhythmEl.style.display = 'inline-block';
            } else {
                rhythmEl.style.display = 'none';
            }
        };

        // Update saveSong to include rhythm
        const originalSaveSongFunc = saveSong;
        saveSong = function() {
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
                rhythm: document.getElementById('rhythmPattern').value.trim(),
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
        };

        // Update editCurrentSong to load rhythm
        const originalEditCurrentSongFunc = editCurrentSong;
        editCurrentSong = function() {
            const song = appState.currentSong;
            appState.editingId = song.id;
            appState.currentAlbumArtData = song.albumArt;
            
            document.getElementById('modalTitle').textContent = 'Edit Song';
            document.getElementById('songTitle').value = song.title;
            document.getElementById('artistName').value = song.artist;
            
            if (song.albumArt) {
                document.getElementById('albumArtPreview').src = song.albumArt;
                document.getElementById('albumArtPreview').classList.add('show');
            }
            
            document.getElementById('capoPosition').value = song.capo;
            document.getElementById('rhythmPattern').value = song.rhythm || '';
            document.getElementById('youtubeUrl').value = song.youtube || '';
            document.getElementById('lyricsChords').value = song.lyrics;
            
            switchTab('manual');
            document.getElementById('songModal').classList.add('active');
        };

        // Fix font change to not jump to top
        const originalChangeFont = changeFont;
        changeFont = function() {
            const font = document.getElementById('fontSelect').value;
            const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
            
            appState.selectedFont = font;
            document.getElementById('songContent').style.setProperty('--content-font', font);
            localStorage.setItem('selectedFont', font);
            
            // Restore scroll position
            setTimeout(() => {
                window.scrollTo(0, currentScroll);
            }, 0);
        };

        // Chord Learning System
        let chordKnowledge = {
            known: [],
            learning: []
        };

        let currentChordInDetail = null;
        let learningFilterChord = null;

        function loadChordKnowledge() {
            const stored = localStorage.getItem('chordKnowledge');
            if (stored) {
                chordKnowledge = JSON.parse(stored);
            }
        }

        function saveChordKnowledge() {
            localStorage.setItem('chordKnowledge', JSON.stringify(chordKnowledge));
        }

        function openChordLibrary() {
            document.getElementById('chordLibraryModal').classList.add('active');
            displayChordLibrary();
        }

        function closeChordLibrary() {
            document.getElementById('chordLibraryModal').classList.remove('active');
        }

        function displayChordLibrary() {
            const grid = document.getElementById('chordLibraryGrid');
            grid.innerHTML = '';
            
            Object.keys(chordDiagrams).sort().forEach(chord => {
                const card = document.createElement('div');
                card.className = 'chord-card';
                
                if (chordKnowledge.known.includes(chord)) {
                    card.classList.add('known');
                } else if (chordKnowledge.learning.includes(chord)) {
                    card.classList.add('learning');
                }
                
                let status = '';
                if (chordKnowledge.known.includes(chord)) {
                    status = '✓ Known';
                } else if (chordKnowledge.learning.includes(chord)) {
                    status = '📚 Learning';
                }
                
                card.innerHTML = `
                    <div class="chord-name">${chord}</div>
                    <div class="chord-status">${status || 'Not learned'}</div>
                `;
                
                card.onclick = () => openChordDetail(chord);
                grid.appendChild(card);
            });
        }

        function openChordDetail(chord) {
            currentChordInDetail = chord;
            const modal = document.getElementById('chordDetailModal');
            const title = document.getElementById('chordDetailTitle');
            const svg = document.getElementById('chordDetailSvg');
            const strumPattern = document.getElementById('chordStrumPattern');
            
            title.textContent = `${chord} Chord`;
            
            if (chordDiagrams[chord]) {
                svg.innerHTML = drawChordDiagram(chordDiagrams[chord].fingers);
                strumPattern.textContent = `Suggested Strum: ${chordDiagrams[chord].strum}`;
            }
            
            updateChordDetailButtons();
            modal.classList.add('active');
        }

        function closeChordDetail() {
            document.getElementById('chordDetailModal').classList.remove('active');
        }

        function updateChordDetailButtons() {
            const knownBtn = document.getElementById('markKnownBtn');
            const learningBtn = document.getElementById('markLearningBtn');
            const unknownBtn = document.getElementById('markUnknownBtn');
            
            // Reset all
            [knownBtn, learningBtn, unknownBtn].forEach(btn => {
                btn.style.opacity = '0.5';
                btn.style.transform = 'scale(1)';
            });
            
            if (chordKnowledge.known.includes(currentChordInDetail)) {
                knownBtn.style.opacity = '1';
                knownBtn.style.transform = 'scale(1.05)';
            } else if (chordKnowledge.learning.includes(currentChordInDetail)) {
                learningBtn.style.opacity = '1';
                learningBtn.style.transform = 'scale(1.05)';
            } else {
                unknownBtn.style.opacity = '1';
                unknownBtn.style.transform = 'scale(1.05)';
            }
        }

        function markChordKnown() {
            chordKnowledge.learning = chordKnowledge.learning.filter(c => c !== currentChordInDetail);
            if (!chordKnowledge.known.includes(currentChordInDetail)) {
                chordKnowledge.known.push(currentChordInDetail);
            }
            saveChordKnowledge();
            updateChordDetailButtons();
            displayChordLibrary();
        }

        function markChordLearning() {
            chordKnowledge.known = chordKnowledge.known.filter(c => c !== currentChordInDetail);
            if (!chordKnowledge.learning.includes(currentChordInDetail)) {
                chordKnowledge.learning.push(currentChordInDetail);
            }
            saveChordKnowledge();
            updateChordDetailButtons();
            displayChordLibrary();
        }

        function markChordUnknown() {
            chordKnowledge.known = chordKnowledge.known.filter(c => c !== currentChordInDetail);
            chordKnowledge.learning = chordKnowledge.learning.filter(c => c !== currentChordInDetail);
            saveChordKnowledge();
            updateChordDetailButtons();
            displayChordLibrary();
        }

        function showSongsWithChord() {
            learningFilterChord = currentChordInDetail;
            closeChordDetail();
            closeChordLibrary();
            setBrowseMode('learning');
            
            // Show filter banner
            document.getElementById('learningFilter').style.display = 'flex';
            document.getElementById('learningChordName').textContent = currentChordInDetail;
        }

        function clearLearningFilter() {
            learningFilterChord = null;
            document.getElementById('learningFilter').style.display = 'none';
            setBrowseMode('name');
        }

        function canPlaySong(song) {
            const songChords = extractChords(song.lyrics, 0);
            return songChords.every(chord => {
                const baseChord = chord.replace(/[0-9]|sus|add/g, '').trim();
                return chordKnowledge.known.includes(baseChord);
            });
        }

        function isLearningSong(song) {
            if (learningFilterChord) {
                // Filter for specific chord being learned
                const songChords = extractChords(song.lyrics, 0);
                const baseChords = songChords.map(c => c.replace(/[0-9]|sus|add/g, '').trim());
                
                // Must contain the learning chord
                if (!baseChords.includes(learningFilterChord)) {
                    return false;
                }
                
                // All other chords must be known
                return baseChords.every(chord => 
                    chord === learningFilterChord || chordKnowledge.known.includes(chord)
                );
            } else {
                // General learning songs: has at least one learning chord, rest are known
                const songChords = extractChords(song.lyrics, 0);
                const baseChords = songChords.map(c => c.replace(/[0-9]|sus|add/g, '').trim());
                
                let hasLearningChord = false;
                let allOthersKnown = true;
                
                baseChords.forEach(chord => {
                    if (chordKnowledge.learning.includes(chord)) {
                        hasLearningChord = true;
                    } else if (!chordKnowledge.known.includes(chord)) {
                        allOthersKnown = false;
                    }
                });
                
                return hasLearningChord && allOthersKnown;
            }
        }

        // Update displaySongs to handle new browse modes
        const originalDisplaySongsFunc = displaySongs;
        displaySongs = function() {
            const container = document.getElementById('songsList');
            let filtered = appState.songs.filter(s => s.category === appState.currentCategory);
            
            // Apply chord knowledge filters
            if (appState.browseMode === 'known') {
                filtered = filtered.filter(canPlaySong);
            } else if (appState.browseMode === 'learning') {
                filtered = filtered.filter(isLearningSong);
            }
            
            container.innerHTML = '';

            if (filtered.length === 0) {
                let message = 'No songs yet. Add your first song!';
                if (appState.browseMode === 'known') {
                    message = 'No songs you can fully play yet. Mark chords as known in the Chord Library!';
                } else if (appState.browseMode === 'learning') {
                    if (learningFilterChord) {
                        message = `No songs found with "${learningFilterChord}" and only known chords.`;
                    } else {
                        message = 'No learning songs found. Mark chords as learning in the Chord Library!';
                    }
                }
                container.innerHTML = `<p style="text-align:center;color:#718096;padding:40px;">${message}</p>`;
                updateSongCounter();
                return;
            }

            if (appState.browseMode === 'name' || appState.browseMode === 'known' || appState.browseMode === 'learning') {
                const sorted = filtered.sort((a, b) => a.title.localeCompare(b.title));
                sorted.forEach(song => {
                    const item = createSongItem(song);
                    
                    // Add badge for songs you can play
                    if (appState.browseMode === 'name' || appState.browseMode === 'artist') {
                        if (canPlaySong(song)) {
                            const badge = document.createElement('span');
                            badge.className = 'badge badge-success';
                            badge.textContent = '✓ Can Play';
                            item.querySelector('.song-item-info').appendChild(badge);
                        } else if (isLearningSong(song)) {
                            const badge = document.createElement('span');
                            badge.className = 'badge badge-warning';
                            badge.textContent = '📚 Learning';
                            item.querySelector('.song-item-info').appendChild(badge);
                        }
                    }
                    
                    container.appendChild(item);
                });
            } else {
                const byArtist = {};
                filtered.forEach(song => {
                    if (!byArtist[song.artist]) {
                        byArtist[song.artist] = [];
                    }
                    byArtist[song.artist].push(song);
                });

                const sortedArtists = Object.keys(byArtist).sort();
                sortedArtists.forEach(artist => {
                    const group = document.createElement('div');
                    group.className = 'artist-group';
                    
                    const header = document.createElement('div');
                    header.className = 'artist-header';
                    header.textContent = artist;
                    group.appendChild(header);

                    byArtist[artist].sort((a, b) => a.title.localeCompare(b.title))
                        .forEach(song => {
                            const item = createSongItem(song);
                            
                            if (canPlaySong(song)) {
                                const badge = document.createElement('span');
                                badge.className = 'badge badge-success';
                                badge.textContent = '✓ Can Play';
                                item.querySelector('.song-item-info').appendChild(badge);
                            } else if (isLearningSong(song)) {
                                const badge = document.createElement('span');
                                badge.className = 'badge badge-warning';
                                badge.textContent = '📚 Learning';
                                item.querySelector('.song-item-info').appendChild(badge);
                            }
                            
                            group.appendChild(item);
                        });

                    container.appendChild(group);
                });
            }
            
            updateSongCounter();
        };

        // Load colors and recently played on startup
        document.addEventListener('DOMContentLoaded', () => {
            loadSavedColors();
            loadRecentlyPlayed();
            loadChordKnowledge();
        });
