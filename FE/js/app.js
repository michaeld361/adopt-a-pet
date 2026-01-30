// API Configuration
const API_BASE_URL = window.API_BASE_URL || 'http://localhost:3000';

// App State
const state = {
    selectedPetType: 'dogs',
    capturedImage: null,
    capturedBlob: null,
    currentMatch: null,
    allMatches: [], // All matches from current API response
    stream: null,
    facingMode: 'user'
};

// Local Storage Keys
const STORAGE_KEYS = {
    MATCHES: 'petalikey_matches',
    USER_PHOTOS: 'petalikey_user_photos'
};

// ============================================
// LOCAL STORAGE FUNCTIONS
// ============================================

function generateRandomScores() {
    return {
        appearance: Math.floor(Math.random() * 30) + 70, // 70-99
        expression: Math.floor(Math.random() * 35) + 65, // 65-99
        character: Math.floor(Math.random() * 40) + 60   // 60-99
    };
}

function saveMatchToStorage(match, userPhoto) {
    const storedMatches = getStoredMatches();

    // Generate random match scores for this match
    const randomScores = generateRandomScores();

    // Add timestamp, user photo, and random scores to match
    const matchWithMeta = {
        ...match,
        userPhoto: userPhoto,
        timestamp: Date.now(),
        id: match.id,
        matchScores: randomScores
    };

    // Remove existing match if present (so we can move it to front)
    const existingIndex = storedMatches.findIndex(m => m.id === match.id);
    if (existingIndex >= 0) {
        storedMatches.splice(existingIndex, 1);
    }

    // Always add to the beginning
    storedMatches.unshift(matchWithMeta);

    // Keep only last 20 matches
    const trimmedMatches = storedMatches.slice(0, 20);

    localStorage.setItem(STORAGE_KEYS.MATCHES, JSON.stringify(trimmedMatches));
    return trimmedMatches;
}

function getStoredMatches() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.MATCHES);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error('Error reading stored matches:', e);
        return [];
    }
}

function clearStoredMatches() {
    localStorage.removeItem(STORAGE_KEYS.MATCHES);
}

// Page Elements
const pages = {
    intro: document.getElementById('intro-page'),
    petType: document.getElementById('pet-type-page'),
    photoOptions: document.getElementById('photo-options-page'),
    camera: document.getElementById('camera-page'),
    preview: document.getElementById('preview-page'),
    loading: document.getElementById('loading-page'),
    results: document.getElementById('results-page')
};

// ============================================
// PAGE NAVIGATION
// ============================================

function showPage(pageName) {
    Object.values(pages).forEach(page => page.classList.remove('active'));
    if (pages[pageName]) {
        pages[pageName].classList.add('active');
    }

    // Scroll to top of phone frame
    document.querySelector('.phone-frame').scrollTop = 0;
}

// ============================================
// INTRO PAGE (Screen 1)
// ============================================

document.getElementById('start-btn').addEventListener('click', () => {
    showPage('petType');
});

document.getElementById('view-matches-btn').addEventListener('click', () => {
    renderMatchesList();
    showPage('results');
    // Switch to matches tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === 'matches');
    });
    document.querySelectorAll('[data-section]').forEach(section => {
        section.classList.toggle('active', section.dataset.section === 'matches');
    });
});

// ============================================
// PET TYPE PAGE (Screen 2)
// ============================================

const petTypeCards = document.querySelectorAll('.pet-type-card');

petTypeCards.forEach(card => {
    card.addEventListener('click', () => {
        if (card.classList.contains('disabled')) {
            return;
        }

        // Update selection
        petTypeCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        state.selectedPetType = card.dataset.pet;

        // Go to photo options after short delay
        setTimeout(() => {
            showPage('photoOptions');
        }, 300);
    });
});

// ============================================
// PHOTO OPTIONS PAGE (Screen 3)
// ============================================

document.getElementById('change-pet-btn').addEventListener('click', () => {
    showPage('petType');
});

document.getElementById('take-photo-btn').addEventListener('click', () => {
    showPage('camera');
    startCamera();
});

document.getElementById('upload-photo-btn').addEventListener('click', () => {
    document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        state.capturedBlob = file;
        const reader = new FileReader();
        reader.onload = (event) => {
            state.capturedImage = event.target.result;
            showPreview();
        };
        reader.readAsDataURL(file);
    }
});

// ============================================
// CAMERA PAGE (Screen 4)
// ============================================

async function startCamera() {
    try {
        const constraints = {
            video: { facingMode: state.facingMode }
        };
        state.stream = await navigator.mediaDevices.getUserMedia(constraints);
        document.getElementById('camera-video').srcObject = state.stream;
    } catch (err) {
        console.error('Error accessing camera:', err);
        alert('Unable to access camera. Please try uploading a photo instead.');
        showPage('photoOptions');
    }
}

function stopCamera() {
    if (state.stream) {
        state.stream.getTracks().forEach(track => track.stop());
        state.stream = null;
    }
}

document.getElementById('close-camera').addEventListener('click', () => {
    stopCamera();
    showPage('photoOptions');
});

document.getElementById('switch-camera').addEventListener('click', () => {
    state.facingMode = state.facingMode === 'user' ? 'environment' : 'user';
    stopCamera();
    startCamera();
});

document.getElementById('capture-btn').addEventListener('click', () => {
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    state.capturedImage = canvas.toDataURL('image/jpeg');

    canvas.toBlob(blob => {
        state.capturedBlob = blob;
        stopCamera();
        showPreview();
    }, 'image/jpeg');
});

// ============================================
// PREVIEW PAGE (Screen 5)
// ============================================

function showPreview() {
    document.getElementById('preview-photo').src = state.capturedImage;
    showPage('preview');
}

document.getElementById('retake-btn').addEventListener('click', () => {
    state.capturedImage = null;
    state.capturedBlob = null;
    showPage('camera');
    startCamera();
});

document.getElementById('submit-btn').addEventListener('click', () => {
    processImage();
});

// ============================================
// LOADING & API (Screen 6)
// ============================================

async function processImage() {
    showPage('loading');

    const formData = new FormData();
    if (state.capturedBlob instanceof File) {
        formData.append('photo', state.capturedBlob);
    } else {
        formData.append('photo', state.capturedBlob, 'photo.jpg');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/match`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Failed to get match');
        }

        const data = await response.json();

        // Minimum loading time for UX
        await new Promise(resolve => setTimeout(resolve, 2500));

        if (data.matches && data.matches.length > 0) {
            state.allMatches = data.matches;
            state.currentMatch = data.matches[0];
            displayResults();
        } else {
            throw new Error('No matches found');
        }
    } catch (err) {
        console.error('Error:', err);
        alert('Failed to find a match. Please try again.');
        showPage('photoOptions');
    }
}

// ============================================
// RESULTS PAGE (Screens 7 & 8)
// ============================================

function displayResults() {
    const match = state.currentMatch;

    // Generate random scores for this match
    const randomScores = generateRandomScores();
    match.matchScores = randomScores;

    // Save only the top match to localStorage (one entry per session)
    saveMatchToStorage(match, state.capturedImage);

    // Update all dog name instances
    const dogName = match.name;
    document.getElementById('dog-name').textContent = dogName;
    document.getElementById('dog-name-btn').textContent = dogName;
    document.getElementById('dog-name-intro').textContent = dogName;

    // Update dog image
    const dogImageUrl = `${API_BASE_URL}/dog-images/${match.id}`;
    document.getElementById('dog-image').src = dogImageUrl;
    document.getElementById('dog-photo-comparison').src = dogImageUrl;

    // Update user photo in results
    document.getElementById('user-photo-result').src = state.capturedImage;
    document.getElementById('restart-photo').src = state.capturedImage;

    // Update dog details
    document.getElementById('dog-details').innerHTML =
        `${match.breed} &middot; ${match.ageText} &middot; ${match.sex}`;

    // Update location
    document.getElementById('dog-location').innerHTML =
        `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
        </svg> ${match.location}`;

    // Update description
    document.getElementById('dog-description').textContent = match.description;

    // Animate match scores after a delay
    setTimeout(() => {
        document.getElementById('appearance-score').style.width = `${match.matchScores.appearance}%`;
        document.getElementById('expression-score').style.width = `${match.matchScores.expression}%`;
        document.getElementById('character-score').style.width = `${match.matchScores.character}%`;
    }, 500);

    // Render matches list
    renderMatchesList();

    showPage('results');
}

function renderMatchesList() {
    const matchesList = document.getElementById('matches-list');
    const noMatchesMessage = document.getElementById('no-matches-message');
    const storedMatches = getStoredMatches();

    if (!matchesList) return;

    if (storedMatches.length === 0) {
        matchesList.innerHTML = '';
        if (noMatchesMessage) noMatchesMessage.style.display = 'block';
        return;
    }

    if (noMatchesMessage) noMatchesMessage.style.display = 'none';

    matchesList.innerHTML = storedMatches.map((match, index) => `
        <div class="match-card ${index === 0 ? 'top-match' : ''}" data-match-index="${index}">
            <img src="${API_BASE_URL}/dog-images/${match.id}" alt="${match.name}" class="match-card-image">
            ${index === 0 ? '<div class="match-card-badge"><span>★</span> Top Match</div>' : ''}
            <h3 class="match-card-name">${match.name}</h3>
            <p class="match-card-details">${match.breed} · ${match.ageText} · ${match.sex}</p>
            <p class="match-card-location">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                </svg>
                ${match.location}
            </p>
            <p class="match-card-description">${match.description}</p>
            <div class="match-card-actions">
                <button class="share-btn">↗</button>
                <button class="more-btn" onclick="viewMatchDetails(${index})">More about ${match.name}</button>
                <button class="heart-btn">♡</button>
            </div>
        </div>
    `).join('');

    // Add click handlers to match cards
    matchesList.querySelectorAll('.match-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't trigger if clicking on buttons
            if (e.target.closest('button')) return;
            const index = parseInt(card.dataset.matchIndex);
            viewMatchDetails(index);
        });
    });
}

function viewMatchDetails(index) {
    const storedMatches = getStoredMatches();
    if (index >= 0 && index < storedMatches.length) {
        const match = storedMatches[index];
        state.currentMatch = match;

        // Update the overview tab with this match's details
        const dogName = match.name;
        document.getElementById('dog-name').textContent = dogName;
        document.getElementById('dog-name-btn').textContent = dogName;
        document.getElementById('dog-name-intro').textContent = dogName;

        const dogImageUrl = `${API_BASE_URL}/dog-images/${match.id}`;
        document.getElementById('dog-image').src = dogImageUrl;
        document.getElementById('dog-photo-comparison').src = dogImageUrl;

        // Use stored user photo if available
        if (match.userPhoto) {
            document.getElementById('user-photo-result').src = match.userPhoto;
            document.getElementById('restart-photo').src = match.userPhoto;
            state.capturedImage = match.userPhoto;
        }

        document.getElementById('dog-details').innerHTML =
            `${match.breed} &middot; ${match.ageText} &middot; ${match.sex}`;

        document.getElementById('dog-location').innerHTML =
            `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
            </svg> ${match.location}`;

        document.getElementById('dog-description').textContent = match.description;

        // Reset and animate scores
        document.getElementById('appearance-score').style.width = '0%';
        document.getElementById('expression-score').style.width = '0%';
        document.getElementById('character-score').style.width = '0%';

        setTimeout(() => {
            document.getElementById('appearance-score').style.width = `${match.matchScores.appearance}%`;
            document.getElementById('expression-score').style.width = `${match.matchScores.expression}%`;
            document.getElementById('character-score').style.width = `${match.matchScores.character}%`;
        }, 300);

        // Switch to overview tab
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === 'overview');
        });
        document.querySelectorAll('[data-section]').forEach(section => {
            section.classList.toggle('active', section.dataset.section === 'overview');
        });

        // Scroll to top
        document.querySelector('.phone-frame').scrollTop = 0;
    }
}

// Tab Navigation
const tabButtons = document.querySelectorAll('.tab-btn');
const sections = document.querySelectorAll('[data-section]');

tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;

        // Update active tab
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Show corresponding section
        sections.forEach(section => {
            if (section.dataset.section === tab) {
                section.classList.add('active');
            } else {
                section.classList.remove('active');
            }
        });
    });
});

// More about button
document.getElementById('more-about-btn').addEventListener('click', () => {
    alert(`Learn more about ${state.currentMatch?.name || 'this pet'} at adoptapet.com!`);
});

// ============================================
// RESTART TAB FUNCTIONALITY
// ============================================

document.getElementById('change-pet-btn-restart')?.addEventListener('click', () => {
    showPage('petType');
});

document.getElementById('remove-photo-btn')?.addEventListener('click', () => {
    state.capturedImage = null;
    state.capturedBlob = null;
    document.getElementById('restart-photo').src = '';
});

document.getElementById('retake-photo-btn')?.addEventListener('click', () => {
    showPage('camera');
    startCamera();
});

document.getElementById('reupload-photo-btn')?.addEventListener('click', () => {
    document.getElementById('file-input').click();
});

document.getElementById('confirm-changes-btn')?.addEventListener('click', () => {
    if (state.capturedImage && state.capturedBlob) {
        processImage();
    } else {
        alert('Please take or upload a photo first.');
    }
});

// ============================================
// FLOATING PETS ANIMATION (Loading Screen)
// ============================================

class FloatingPetsAnimation {
    constructor(container) {
        this.container = container;
        this.pets = Array.from(container.querySelectorAll('.floating-pet'));
        this.particles = [];
        this.animationId = null;
        this.isRunning = false;
        this.styles = ['style-1', 'style-2', 'style-3', 'style-4', 'style-5'];
    }

    init() {
        const containerRect = this.container.getBoundingClientRect();
        const width = containerRect.width || 390;
        const height = containerRect.height || 700;

        this.pets.forEach((pet, index) => {
            // Random starting position (can start partially off-screen)
            const x = Math.random() * width - 35;
            const y = Math.random() * height - 35;

            // Random velocity - subtle and slow
            const speed = 0.15 + Math.random() * 0.25;
            const angle = Math.random() * Math.PI * 2;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;

            // Random style
            const styleClass = this.styles[Math.floor(Math.random() * this.styles.length)];
            pet.classList.add(styleClass);

            // Fixed size - no scaling
            const size = 65 + Math.random() * 20;
            pet.style.width = `${size}px`;
            pet.style.height = `${size}px`;

            this.particles.push({
                element: pet,
                x, y, vx, vy,
                size,
                width,
                height
            });

            // Set initial position
            pet.style.left = `${x}px`;
            pet.style.top = `${y}px`;

            // Stagger the appearance
            setTimeout(() => {
                pet.classList.add('active');
            }, index * 150);
        });
    }

    animate() {
        if (!this.isRunning) return;

        this.particles.forEach(particle => {
            // Update position
            particle.x += particle.vx;
            particle.y += particle.vy;

            // Wrap around screen edges (go off one side, appear on the other)
            if (particle.x < -particle.size) {
                particle.x = particle.width + 10;
            } else if (particle.x > particle.width + 10) {
                particle.x = -particle.size;
            }
            if (particle.y < -particle.size) {
                particle.y = particle.height + 10;
            } else if (particle.y > particle.height + 10) {
                particle.y = -particle.size;
            }

            // Apply position (no rotation or scaling)
            particle.element.style.left = `${particle.x}px`;
            particle.element.style.top = `${particle.y}px`;
        });

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.init();
        this.animate();
    }

    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        // Hide all pets
        this.pets.forEach(pet => {
            pet.classList.remove('active');
        });
        // Reset particles
        this.particles = [];
    }

    reset() {
        this.stop();
        this.pets.forEach(pet => {
            this.styles.forEach(s => pet.classList.remove(s));
            pet.style.left = '';
            pet.style.top = '';
            pet.style.width = '';
            pet.style.height = '';
        });
    }
}

// Global animation instance
let floatingPetsAnimation = null;

// ============================================
// INITIALIZATION
// ============================================

function init() {
    // Pre-select Dogs on pet type page
    const dogsCard = document.querySelector('[data-pet="dogs"]');
    if (dogsCard) {
        dogsCard.classList.add('selected');
    }

    // Initialize floating pets animation
    const floatingContainer = document.querySelector('.floating-pets');
    if (floatingContainer) {
        floatingPetsAnimation = new FloatingPetsAnimation(floatingContainer);
    }

    // Show view matches button if there are stored matches
    updateViewMatchesButton();

    // Render any stored matches
    renderMatchesList();
}

function updateViewMatchesButton() {
    const viewMatchesBtn = document.getElementById('view-matches-btn');
    const storedMatches = getStoredMatches();
    if (viewMatchesBtn) {
        viewMatchesBtn.style.display = storedMatches.length > 0 ? 'block' : 'none';
    }
}

// Override showPage to control animation
const originalShowPage = showPage;
showPage = function(pageName) {
    // Stop animation when leaving loading page
    if (floatingPetsAnimation) {
        if (pageName === 'loading') {
            floatingPetsAnimation.reset();
            // Small delay to let the page render
            setTimeout(() => {
                floatingPetsAnimation.start();
            }, 100);
        } else {
            floatingPetsAnimation.stop();
        }
    }

    // Update view matches button when returning to intro
    if (pageName === 'intro') {
        updateViewMatchesButton();
    }

    originalShowPage(pageName);
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
