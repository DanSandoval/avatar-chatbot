// D-ID Avatar Presets Configuration
const AVATAR_PRESETS = {
    emma: {
        name: "Dr. Elias Grant",
        source_url: "https://sdmntprwestus2.oaiusercontent.com/files/00000000-c1cc-61f8-b1c1-32e18ac16218/raw?se=2025-07-16T20%3A16%3A13Z&sp=r&sv=2024-08-04&sr=b&scid=c4bb53a1-5ac2-5c21-9c3a-3047630aafc0&skoid=61180a4f-34a9-42b7-b76d-9ca47d89946d&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2025-07-16T01%3A13%3A13Z&ske=2025-07-17T01%3A13%3A13Z&sks=b&skv=2024-08-04&sig=jOfQ7cHqj3yaQZIeBJPG%2BQMQPLQ2osd75kYU3yPI/P8%3D",
        preview_url: "/images/dr-elias-grant.png",
        gender: "male"
    }
};

// Avatar selection handling
class AvatarSelector {
    constructor() {
        this.currentAvatar = AVATAR_PRESETS.emma.source_url;
        this.initializeEventListeners();
        this.updatePreview(AVATAR_PRESETS.emma.preview_url);
    }

    initializeEventListeners() {
        // Radio button change
        document.querySelectorAll('input[name="avatar-type"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.handleAvatarTypeChange(e));
        });

        // Preset selection change
        const presetSelect = document.getElementById('preset-avatar-select');
        if (presetSelect) {
            presetSelect.addEventListener('change', (e) => this.handlePresetChange(e));
        }

        // Custom URL input
        const customUrlInput = document.getElementById('custom-avatar-url');
        if (customUrlInput) {
            customUrlInput.addEventListener('input', (e) => this.handleCustomUrlInput(e));
        }
    }

    handleAvatarTypeChange(event) {
        const type = event.target.value;
        const presetDiv = document.getElementById('preset-avatars');
        const customDiv = document.getElementById('custom-avatar');

        if (type === 'preset') {
            presetDiv.classList.remove('hidden');
            customDiv.classList.add('hidden');
            this.handlePresetChange({ target: document.getElementById('preset-avatar-select') });
        } else {
            presetDiv.classList.add('hidden');
            customDiv.classList.remove('hidden');
            this.handleCustomUrlInput({ target: document.getElementById('custom-avatar-url') });
        }
    }

    handlePresetChange(event) {
        const avatarKey = event.target.value;
        const avatar = AVATAR_PRESETS[avatarKey];
        if (avatar) {
            this.currentAvatar = avatar.source_url;
            this.updatePreview(avatar.preview_url);
        }
    }

    handleCustomUrlInput(event) {
        const input = event.target;
        const url = input.value.trim();
        
        // Remove validation classes
        input.classList.remove('valid', 'invalid');
        
        if (url === '') {
            this.updatePreview(null);
            return;
        }
        
        if (this.isValidImageUrl(url)) {
            input.classList.add('valid');
            this.currentAvatar = url;
            this.updatePreview(url);
        } else {
            input.classList.add('invalid');
            this.updatePreview(null);
        }
    }

    isValidImageUrl(url) {
        try {
            const urlObj = new URL(url);
            // Check if HTTPS
            if (urlObj.protocol !== 'https:') {
                return false;
            }
            
            // Allow common image extensions or common image hosting patterns
            const pathname = urlObj.pathname.toLowerCase();
            const hostname = urlObj.hostname.toLowerCase();
            
            // Direct image files
            if (/\.(jpg|jpeg|png|webp|gif)$/i.test(pathname)) {
                return true;
            }
            
            // Common image hosting services
            if (hostname.includes('unsplash.com') ||
                hostname.includes('pexels.com') ||
                hostname.includes('cloudinary.com') ||
                hostname.includes('imgur.com') ||
                hostname.includes('d-id.com') ||
                hostname.includes('githubusercontent.com')) {
                return true;
            }
            
            // Allow any HTTPS URL as D-ID will validate it
            return true;
        } catch {
            return false;
        }
    }

    updatePreview(url = null) {
        const previewImg = document.getElementById('avatar-preview-img');
        const placeholder = document.querySelector('.avatar-placeholder');
        
        if (url) {
            previewImg.src = url;
            previewImg.onload = () => {
                previewImg.classList.add('loaded');
                if (placeholder) {
                    placeholder.style.display = 'none';
                }
            };
            previewImg.onerror = () => {
                previewImg.classList.remove('loaded');
                if (placeholder) {
                    placeholder.style.display = 'flex';
                }
                console.error('Failed to load avatar preview:', url);
            };
        } else {
            previewImg.classList.remove('loaded');
            if (placeholder) {
                placeholder.style.display = 'flex';
            }
        }
    }

    getCurrentAvatar() {
        return this.currentAvatar;
    }
}

// Initialize avatar selector when DOM is ready
let avatarSelector;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        avatarSelector = new AvatarSelector();
    });
} else {
    avatarSelector = new AvatarSelector();
}