document.addEventListener('DOMContentLoaded', () => {
    let rawData = [];
    let currentHeroLines = [];
    let currentAudio = null;
    let playingItem = null;

    const heroListEl = document.getElementById('hero-list');
    const voicelinesContainer = document.getElementById('voicelines-container');
    const heroSearchInput = document.getElementById('hero-search');
    const lineSearchInput = document.getElementById('line-search');
    const currentHeroTitle = document.getElementById('current-hero-name');
    const voicelineSearchContainer = document.getElementById('voiceline-search-container');

    // Load data.js
    if (window.VOICELINE_DATA) {
        rawData = window.VOICELINE_DATA.sort((a, b) => a.hero.localeCompare(b.hero));
        renderHeroes(rawData);
    } else {
        heroListEl.innerHTML = `<li class="hero-item text-red" style="color:#ff474b;">Failed to load data.js</li>`;
    }

    function renderHeroes(heroes) {
        heroListEl.innerHTML = '';
        heroes.forEach(hero => {
            const li = document.createElement('li');
            li.className = 'hero-item';

            li.innerHTML = `
                <span class="hero-name">${hero.hero}</span>
                <span class="line-count">${hero.lines.length}</span>
            `;

            li.addEventListener('click', () => {
                // Highlight active
                document.querySelectorAll('.hero-item').forEach(el => el.classList.remove('active'));
                li.classList.add('active');

                showVoicelines(hero);
            });
            heroListEl.appendChild(li);
        });
    }

    function showVoicelines(heroData) {
        currentHeroTitle.textContent = heroData.hero;
        currentHeroLines = heroData.lines;
        voicelineSearchContainer.style.display = 'flex';
        lineSearchInput.value = '';

        renderVoicelines(currentHeroLines);
    }

    function renderVoicelines(lines) {
        voicelinesContainer.innerHTML = '';

        if (lines.length === 0) {
            voicelinesContainer.innerHTML = `
                <div class="empty-state">
                    <p>No voicelines found matching your search.</p>
                </div>
            `;
            return;
        }

        // Fast DOM fragment insert
        const fragment = document.createDocumentFragment();

        lines.forEach((line, index) => {
            const div = document.createElement('div');
            // Distribute stagger classes up to 5, rest apply .stagger-more
            const animClass = index < 5 ? `stagger-${index + 1}` : 'stagger-more';
            div.className = `voiceline-item ${animClass}`;

            // Clean URL from query parameters if needed, but fandom needs them
            let audioSrc = line.audio;
            if (audioSrc && audioSrc.startsWith('/')) {
                // Sometimes audio URLs start with / - resolve them
                audioSrc = 'https://dota2.fandom.com' + audioSrc;
            }

            const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;

            div.innerHTML = `
                <div class="play-btn">
                    ${svgIcon}
                </div>
                <div class="voiceline-text">${line.text}</div>
            `;

            div.addEventListener('click', () => {
                playAudio(audioSrc, div);
            });

            fragment.appendChild(div);
        });

        voicelinesContainer.appendChild(fragment);
    }

    function playAudio(src, itemEl) {
        if (!src) return;

        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            if (playingItem) {
                playingItem.classList.remove('playing');
                // Reset icon
                playingItem.querySelector('.play-btn').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
            }
        }

        currentAudio = new Audio(src);
        playingItem = itemEl;
        playingItem.classList.add('playing');

        // Show pause/playing icon
        playingItem.querySelector('.play-btn').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

        currentAudio.play().catch(e => {
            console.error('Audio play failed:', e);
            playingItem.classList.remove('playing');
        });

        currentAudio.onended = () => {
            if (playingItem === itemEl) {
                playingItem.classList.remove('playing');
                playingItem.querySelector('.play-btn').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
                playingItem = null;
                currentAudio = null;
            }
        };
    }

    // Searches
    heroSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = rawData.filter(h => h.hero.toLowerCase().includes(query));
        renderHeroes(filtered);
    });

    lineSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = currentHeroLines.filter(l => l.text.toLowerCase().includes(query));
        renderVoicelines(filtered);
    });

    // --- Navigation & Modes ---
    const btnExplorer = document.getElementById('mode-explorer-btn');
    const btnQuiz = document.getElementById('mode-quiz-btn');
    const modeExplorer = document.getElementById('mode-explorer');
    const modeQuiz = document.getElementById('mode-quiz');

    btnExplorer.addEventListener('click', () => {
        btnExplorer.classList.add('active');
        btnQuiz.classList.remove('active');
        modeExplorer.classList.add('active');
        modeQuiz.classList.remove('active');

        // Stop quiz audio if playing
        if (quizAudio) {
            quizAudio.pause();
            quizAudio.currentTime = 0;
            quizPlaying = false;
            updateQuizPlayButtonState();
        }
    });

    btnQuiz.addEventListener('click', () => {
        btnQuiz.classList.add('active');
        btnExplorer.classList.remove('active');
        modeQuiz.classList.add('active');
        modeExplorer.classList.remove('active');

        // Stop explorer audio if playing
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            if (playingItem) {
                playingItem.classList.remove('playing');
                playingItem.querySelector('.play-btn').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
            }
            playingItem = null;
        }
    });

    // --- Quiz Logic ---
    let quizScore = 0;
    let currentQuizLine = null;
    let quizAudio = null;
    let quizPlaying = false;
    let currentAnswerHero = null;

    const stateStart = document.getElementById('quiz-state-start');
    const statePlaying = document.getElementById('quiz-state-playing');
    const scoreDisplay = document.getElementById('quiz-score');
    const btnStartQuiz = document.getElementById('btn-start-quiz');

    const quizQuoteText = document.getElementById('quiz-quote-text');
    const btnRefreshQuestion = document.getElementById('btn-refresh-question');
    const quizHeroSearch = document.getElementById('quiz-hero-search');
    const quizHeroAutocomplete = document.getElementById('quiz-hero-autocomplete');
    const quizAudioReveal = document.getElementById('quiz-audio-reveal');
    const btnPlayQuizAudio = document.getElementById('btn-play-quiz-audio');

    const quizFeedback = document.getElementById('quiz-feedback');
    const btnNextQuestion = document.getElementById('btn-next-question');

    // Filter out laughs, grunts, missing text, short generic lines, and item names
    function isValidQuizLine(text) {
        if (!text || text.length < 15) return false;

        // Item names and grunts are usually very short
        const words = text.trim().split(/\s+/);
        if (words.length <= 3) return false;

        // Exclude lines with numbers (e.g. "300 Gold", "Level 5")
        if (/\d/.test(text)) return false;

        const lower = text.toLowerCase();
        if (lower.match(/^(ha|he|ho|hm|ugh|ah|oh)\b/i) || lower.includes("haha") || lower.includes("hehe")) {
            // Count words. If it's mostly ha ha ha, reject it
            let laughWords = 0;
            words.forEach(w => {
                if (['ha', 'he', 'ho', 'haha', 'hehe', 'hahaha'].includes(w.toLowerCase().replace(/[^a-z]/g, ''))) laughWords++;
            });
            if (laughWords > words.length * 0.4) return false;
        }

        // Filter out item names using our global items dictionary
        if (window.DOTA_ITEMS) {
            const cleanText = lower.replace(/[^a-z]/g, '');
            if (window.DOTA_ITEMS.includes(cleanText)) return false;
        }

        return true;
    }

    btnStartQuiz.addEventListener('click', () => {
        quizScore = 0;
        scoreDisplay.textContent = quizScore;
        stateStart.classList.remove('active');
        statePlaying.classList.add('active');
        loadNextQuestion();
    });

    btnRefreshQuestion.addEventListener('click', () => {
        // Skipping a question doesn't penalize the score
        loadNextQuestion();
    });

    function getRandomHero() {
        return rawData[Math.floor(Math.random() * rawData.length)];
    }

    function loadNextQuestion() {
        // Reset state
        quizFeedback.textContent = '';
        quizFeedback.className = 'quiz-feedback';
        btnNextQuestion.style.display = 'none';
        quizHeroSearch.value = '';
        quizHeroSearch.disabled = false;
        quizHeroSearch.focus();
        quizHeroAutocomplete.style.display = 'none';
        quizAudioReveal.style.display = 'none';

        if (quizAudio) {
            quizAudio.pause();
            quizAudio = null;
        }
        quizPlaying = false;
        updateQuizPlayButtonState();

        // Pick a hero to be the answer
        let answerHero = null;
        let line = null;

        while (!line) {
            answerHero = getRandomHero();
            if (answerHero.lines.length > 5) {
                let attempts = 0;
                while (!line && attempts < 20) {
                    const temp = answerHero.lines[Math.floor(Math.random() * answerHero.lines.length)];
                    if (isValidQuizLine(temp.text)) {
                        line = temp;
                    }
                    attempts++;
                }
            }
        }

        currentQuizLine = line;
        currentAnswerHero = answerHero.hero;

        // Clean wiki markup letters (e.g. standalone u or r)
        let displayQuote = line.text.replace(/\b[ru]\b/gi, '').replace(/\s{2,}/g, ' ').trim();

        // Render text
        quizQuoteText.textContent = displayQuote;

        // Prep Audio for reveal
        let audioSrc = line.audio;
        if (audioSrc && audioSrc.startsWith('/')) {
            audioSrc = 'https://dota2.fandom.com' + audioSrc;
        }

        quizAudio = new Audio(audioSrc);
        quizAudio.onended = () => {
            quizPlaying = false;
            updateQuizPlayButtonState();
        };
    }

    // Autocomplete Logic
    let autocompleteIndex = -1;

    quizHeroSearch.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        quizHeroAutocomplete.innerHTML = '';
        autocompleteIndex = -1;

        if (!val) {
            quizHeroAutocomplete.style.display = 'none';
            return;
        }

        const filtered = rawData.filter(h => h.hero.toLowerCase().includes(val));
        if (filtered.length > 0) {
            quizHeroAutocomplete.style.display = 'block';
            filtered.forEach((h, index) => {
                const li = document.createElement('li');
                li.className = 'autocomplete-item';
                li.textContent = h.hero;
                li.onclick = () => handleGuess(h.hero);
                quizHeroAutocomplete.appendChild(li);
            });

            // Automatically focus the first item
            autocompleteIndex = 0;
            const items = quizHeroAutocomplete.querySelectorAll('.autocomplete-item');
            updateAutocompleteFocus(items);
        } else {
            quizHeroAutocomplete.style.display = 'none';
        }
    });

    function updateAutocompleteFocus(items) {
        items.forEach((item, index) => {
            if (index === autocompleteIndex) {
                item.classList.add('focused');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('focused');
            }
        });
    }

    // Keyboard Logic
    quizHeroSearch.addEventListener('keydown', (e) => {
        if (quizHeroSearch.disabled) return;

        const items = quizHeroAutocomplete.querySelectorAll('.autocomplete-item');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (items.length === 0) return;
            autocompleteIndex++;
            if (autocompleteIndex >= items.length) autocompleteIndex = 0;
            updateAutocompleteFocus(items);

        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (items.length === 0) return;
            autocompleteIndex--;
            if (autocompleteIndex < 0) autocompleteIndex = items.length - 1;
            updateAutocompleteFocus(items);

        } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation(); // Stop bubbling to prevent accidental next question
            if (autocompleteIndex > -1 && items.length > 0 && autocompleteIndex < items.length) {
                handleGuess(items[autocompleteIndex].textContent);
            } else {
                // Default to top match if nothing is highlighted
                const val = quizHeroSearch.value.toLowerCase().trim();
                if (!val) return;

                const filtered = rawData.filter(h => h.hero.toLowerCase().includes(val));
                if (filtered.length > 0) {
                    const exact = filtered.find(h => h.hero.toLowerCase() === val);
                    const choice = exact || filtered[0];
                    handleGuess(choice.hero);
                }
            }
        }
    });

    // Next Question Enter Shortcut
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && modeQuiz.classList.contains('active') && btnNextQuestion.style.display === 'block') {
            e.preventDefault();
            loadNextQuestion();
        }
    });

    // Hide autocomplete on click outside
    document.addEventListener('click', (e) => {
        if (!quizHeroSearch.contains(e.target) && !quizHeroAutocomplete.contains(e.target)) {
            quizHeroAutocomplete.style.display = 'none';
        }
    });

    function toggleQuizAudio() {
        if (!quizAudio) return;
        if (quizPlaying) {
            quizAudio.pause();
            quizPlaying = false;
        } else {
            quizAudio.currentTime = 0;
            quizAudio.play().catch(e => console.error(e));
            quizPlaying = true;
        }
        updateQuizPlayButtonState();
    }

    function updateQuizPlayButtonState() {
        if (quizPlaying) {
            btnPlayQuizAudio.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
            btnPlayQuizAudio.style.background = 'var(--accent)';
            btnPlayQuizAudio.style.boxShadow = '0 0 10px rgba(210, 164, 90, 0.4)';
        } else {
            btnPlayQuizAudio.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
            btnPlayQuizAudio.style.background = 'var(--primary-color)';
            btnPlayQuizAudio.style.boxShadow = '0 2px 5px rgba(209, 54, 57, 0.3)';
        }
    }

    btnPlayQuizAudio.addEventListener('click', toggleQuizAudio);

    function handleGuess(guessedHero) {
        quizHeroSearch.value = guessedHero;
        quizHeroSearch.disabled = true;
        quizHeroAutocomplete.style.display = 'none';

        if (guessedHero === currentAnswerHero) {
            quizScore++;
            scoreDisplay.textContent = quizScore;
            quizFeedback.textContent = `Correct! It was ${currentAnswerHero}.`;
            quizFeedback.className = 'quiz-feedback feedback-correct';

            // Fire Confetti!
            if (typeof confetti === 'function') {
                confetti({
                    particleCount: 150,
                    spread: 80,
                    origin: { y: 0.6 },
                    colors: ['#d13639', '#d2a45a', '#ffffff'] // Dota themed colors
                });
            }
        } else {
            quizScore = 0;
            scoreDisplay.textContent = quizScore;
            quizFeedback.textContent = `Wrong! The answer was ${currentAnswerHero}. Score reset.`;
            quizFeedback.className = 'quiz-feedback feedback-wrong';
        }

        quizAudioReveal.style.display = 'flex';
        btnNextQuestion.style.display = 'block';
    }

    btnNextQuestion.addEventListener('click', loadNextQuestion);

});
