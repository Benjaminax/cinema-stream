// This script runs inside the YouTube webview (Hardened Direct-Site Cinema Engine)
(function () {
    console.log('🎬 Hardened Cinema Engine: Booting...');

    // 1. Extreme Spoofing - Wipe automation footprints
    try {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        // @ts-ignore
        delete navigator.__proto__.webdriver;
    } catch (e) { }

    const injectStyles = () => {
        const css = `
            /* Initial blackout to prevent site flashes */
            html, body {
                background: black !important;
                color: black !important;
                overflow: hidden !important;
            }

            /* Aggressively hide all YouTube site Chrome & Embed Overlays */
            #masthead-container, 
            #masthead,
            #sidebar,
            #secondary,
            #comments,
            #footer,
            #guide,
            #header,
            #chat,
            .ytd-masthead,
            .ytd-page-manager,
            ytd-popup-container,
            tp-yt-iron-overlay-backdrop,
            .ytp-chrome-top,           /* Embed title and share button */
            .ytp-show-cards-title,      /* "More videos" title */
            .ytp-pause-overlay,         /* Suggestions when paused */
            .ytp-ce-element,            /* End screen elements */
            .ytp-ce-video,
            .ytp-ce-channel,
            .ytp-ce-playlist,
            .ytp-ce-website,
            .ytp-ce-merchandise,
            .ytp-watermark,             /* YouTube watermark */
            .ytp-youtube-button,        /* YouTube logo in bottom right */
            .ytp-gradient-top,          /* Dark gradient at the top */
            .ytp-gradient-bottom {      /* Dark gradient at the bottom */
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
                z-index: -100 !important;
            }
            
            /* Force the primary container to fill the screen */
            ytd-app, 
            #content,
            #page-manager,
            ytd-watch-flexy,
            #columns,
            #primary,
            #primary-inner,
            #player,
            #player-container,
            #player-container-outer,
            #player-container-inner,
            #ytd-player,
            .html5-video-player,
            .html5-main-video {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                margin: 0 !important;
                padding: 0 !important;
                max-width: none !important;
                max-height: none !important;
                z-index: 99999 !important;
                background: black !important;
                border: none !important;
            }

            /* Hide ad overlays and annotations */
            .ytp-ad-overlay-container,
            .ytp-ce-element,
            .iv-drawer,
            .ytp-cards-button,
            .ytp-cards-teaser,
            .ytp-paid-content-overlay,
            .ytp-ad-skip-button-slot {
                display: none !important;
                opacity: 0 !important;
            }

            /* Show controls only on hover */
            .ytp-chrome-bottom {
                opacity: 0;
                transition: opacity 0.5s;
            }
            .html5-video-player:hover .ytp-chrome-bottom {
                opacity: 1;
            }

            /* Kill scrollbars */
            ::-webkit-scrollbar {
                display: none !important;
            }
        `;
        const style = document.createElement('style');
        style.setAttribute('id', 'cinema-engine-styles');
        style.textContent = css;
        if (document.head) {
            document.head.appendChild(style);
        } else {
            const observer = new MutationObserver(() => {
                if (document.head) {
                    document.head.appendChild(style);
                    observer.disconnect();
                }
            });
            observer.observe(document.documentElement, { childList: true });
        }
    };

    const handlePlayback = () => {
        const video = document.querySelector('video');
        const player = document.querySelector('.html5-video-player');

        if (!video) return;

        // 1. AUTO-LOOP & STICKY PLAYBACK
        if (video.ended || (video.duration > 0 && video.currentTime >= video.duration - 0.5)) {
            console.log('🎬 Hardened Cinema Engine: Video ended or near end, replaying...');
            video.currentTime = 0;
            video.play().catch(() => { });
        }

        if (video.paused && !video.ended && !document.querySelector('.ad-showing')) {
            // Force play if not an ad and not actually ended
            video.play().catch(() => {
                const playBtn = document.querySelector('.ytp-play-button');
                // @ts-ignore
                if (playBtn) playBtn.click();
            });
        }

        // 2. AGGRESSIVE AD-SKIPPING
        const isAd = player?.classList.contains('ad-showing') || document.querySelector('.ad-interrupting');
        if (isAd) {
            // Mute during ads
            if (!video.muted) video.muted = true;

            // Speed up ads if possible
            video.playbackRate = 16.0;

            // Multiple skip button variants
            const skipButtons = [
                '.ytp-ad-skip-button',
                '.ytp-ad-skip-button-modern',
                '.ytp-ad-skip-button-slot',
                '.ytp-skip-ad-button'
            ];

            for (const selector of skipButtons) {
                const btn = document.querySelector(selector);
                if (btn) {
                    console.log('🚀 Hardened Cinema Engine: Ad detected, nuking skip button...');
                    // @ts-ignore
                    btn.click();
                }
            }
        } else {
            // Restore playback rate and unmute if we was muting for an ad
            if (video.playbackRate > 2.0) video.playbackRate = 1.0;
            // Note: We don't force unmute here in case user manually muted
        }

        // 3. ERROR RECOVERY
        const errorScreen = document.querySelector('.ytp-error');
        if (errorScreen && errorScreen.getAttribute('aria-hidden') !== 'true') {
            console.warn('⚠️ Hardened Cinema Engine: Player error detected, reloading...');
            window.location.reload();
        }
    };

    // Run immediately and periodically
    injectStyles();

    const interval = setInterval(() => {
        handlePlayback();
        // Force layout check
        window.dispatchEvent(new Event('resize'));
    }, 500); // Faster check for better responsiveness

    // Initial stabilization
    window.addEventListener('load', () => {
        console.log('🎬 Hardened Cinema Engine: Page Loaded');
    });

    // Handle session cleanup
    window.addEventListener('beforeunload', () => clearInterval(interval));
})();
