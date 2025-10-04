// Mid-Autumn Festival Interactive Features
document.addEventListener('DOMContentLoaded', function() {
    
    // Initialize all animations and interactions
    initScrollAnimations();
    initParallaxEffect();
    initInteractiveElements();
    initStarField();
    initSoundEffects();
    initLoveLetter();
    initBackgroundLanterns();
    
    // Scroll-triggered animations
    function initScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('scroll-animate');
                }
            });
        }, observerOptions);
        
        // Observe elements for scroll animations
        const animatedElements = document.querySelectorAll('.tradition-item, .blessing-text, .traditions-section');
        animatedElements.forEach(el => observer.observe(el));
    }
    
    // Parallax effect for clouds
    function initParallaxEffect() {
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            const clouds = document.querySelectorAll('.cloud');
            
            clouds.forEach((cloud, index) => {
                const speed = 0.5 + (index * 0.2); // Different speeds for depth
                const yPos = -(scrolled * speed);
                cloud.style.transform = `translateY(${yPos}px)`;
            });
        });
    }
    
    // Interactive hover effects
    function initInteractiveElements() {
        // Moon hover effect
        const moon = document.querySelector('.moon');
        if (moon) {
            moon.addEventListener('mouseenter', () => {
                moon.style.transform = 'scale(1.1)';
                moon.style.boxShadow = '0 0 50px rgba(244, 208, 63, 0.8)';
            });
            
            moon.addEventListener('mouseleave', () => {
                moon.style.transform = 'scale(1)';
                moon.style.boxShadow = '0 0 30px rgba(244, 208, 63, 0.5)';
            });
        }
        
        // Lantern hover effects
        const lanterns = document.querySelectorAll('.lantern');
        lanterns.forEach(lantern => {
            lantern.addEventListener('mouseenter', () => {
                lantern.style.transform = 'scale(1.2)';
                lantern.style.filter = 'drop-shadow(0 0 25px #f4d03f)';
            });
            
            lantern.addEventListener('mouseleave', () => {
                lantern.style.transform = 'scale(1)';
                lantern.style.filter = 'none';
            });
        });
        
        // Add click effects to interactive elements
        const interactiveElements = document.querySelectorAll('.mooncake, .rabbit, .tradition-item');
        interactiveElements.forEach(element => {
            element.addEventListener('click', () => {
                // Add a pulse effect
                element.style.animation = 'none';
                element.offsetHeight; // Trigger reflow
                element.style.animation = 'pulse 0.6s ease-in-out';
            });
        });
    }
    
    // Enhanced star field with twinkling
    function initStarField() {
        const starsContainer = document.querySelector('.stars');
        if (!starsContainer) return;
        
        // Create additional stars dynamically
        for (let i = 0; i < 50; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            star.style.position = 'absolute';
            star.style.width = Math.random() * 3 + 1 + 'px';
            star.style.height = star.style.width;
            star.style.background = '#fff';
            star.style.borderRadius = '50%';
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 100 + '%';
            star.style.animation = `twinkle ${Math.random() * 3 + 2}s ease-in-out infinite alternate`;
            star.style.animationDelay = Math.random() * 2 + 's';
            starsContainer.appendChild(star);
        }
    }

    // Love Letter interactions
    function initLoveLetter() {
        const envelope = document.querySelector('.envelope');
        const hint = document.querySelector('.open-hint');
        if (!envelope) return;

        const revealLines = () => {
            const lines = envelope.querySelectorAll('.love-line');
            lines.forEach((line, idx) => {
                line.classList.remove('is-visible');
                setTimeout(() => line.classList.add('is-visible'), 220 + idx * 260);
            });
        };

        const openEnvelope = () => {
            envelope.classList.add('is-open');
            envelope.style.filter = 'drop-shadow(0 12px 34px rgba(255,93,143,0.35))';
            revealLines();
        };

        const toggleEnvelope = () => {
            envelope.classList.toggle('is-open');
            if (envelope.classList.contains('is-open')) {
                envelope.style.filter = 'drop-shadow(0 12px 34px rgba(255,93,143,0.35))';
                revealLines();
            } else {
                envelope.style.filter = 'drop-shadow(0 10px 30px rgba(0,0,0,0.35))';
                envelope.querySelectorAll('.love-line').forEach(l => l.classList.remove('is-visible'));
            }
        };

        envelope.addEventListener('click', toggleEnvelope);
        envelope.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleEnvelope();
            }
        });

        if (hint) {
            hint.addEventListener('click', openEnvelope);
        }
    }

    // Background floating lanterns generation
    function initBackgroundLanterns() {
        const layer = document.querySelector('.floating-lanterns');
        if (!layer) return;

        const lanternCount = Math.min(18, Math.max(8, Math.floor(window.innerWidth / 120)));

        for (let i = 0; i < lanternCount; i++) {
            const el = document.createElement('div');
            el.className = 'bg-lantern';
            const size = 18 + Math.random() * 24; // 18-42px
            const x = Math.random() * 100; // vw percent
            const delay = -Math.random() * 28; // negative for staggering
            const dur = 24 + Math.random() * 18; // 24-42s
            const opacity = 0.5 + Math.random() * 0.5;
            const blur = Math.random() < 0.4 ? Math.random() * 1.4 + 'px' : '0px';

            el.style.setProperty('--size', size + 'px');
            el.style.setProperty('--x', x + '%');
            el.style.setProperty('--delay', delay + 's');
            el.style.setProperty('--dur', dur + 's');
            el.style.setProperty('--opacity', opacity);
            el.style.setProperty('--blur', blur);

            layer.appendChild(el);
        }

        // Regenerate on resize (debounced)
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                layer.innerHTML = '';
                initBackgroundLanterns();
            }, 250);
        });
    }
    
    // Sound effects (optional - can be enabled by user)
    function initSoundEffects() {
        // Create audio context for subtle sound effects
        let audioContext;
        
        // Initialize audio on first user interaction
        document.addEventListener('click', initAudio, { once: true });
        
        function initAudio() {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.log('Audio not supported');
            }
        }
        
        // Add gentle sound on hover (optional)
        const soundElements = document.querySelectorAll('.mooncake, .rabbit, .lantern');
        soundElements.forEach(element => {
            element.addEventListener('mouseenter', () => {
                if (audioContext && audioContext.state === 'running') {
                    playGentleSound();
                }
            });
        });
        
        function playGentleSound() {
            if (!audioContext) return;
            
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        }
    }
    
    // Add CSS for pulse animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        
        .star {
            position: absolute;
            background: #fff;
            border-radius: 50%;
            animation: twinkle 3s ease-in-out infinite alternate;
        }
        
        @keyframes twinkle {
            0% { opacity: 0.3; transform: scale(1); }
            100% { opacity: 1; transform: scale(1.2); }
        }
    `;
    document.head.appendChild(style);
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Add loading animation
    window.addEventListener('load', () => {
        document.body.classList.add('loaded');
        
        // Trigger moon rise animation
        const moon = document.querySelector('.moon');
        if (moon) {
            moon.style.animation = 'moonRise 2s ease-out forwards';
        }
    });
    
    // Add mouse movement parallax effect
    document.addEventListener('mousemove', (e) => {
        const mouseX = e.clientX / window.innerWidth;
        const mouseY = e.clientY / window.innerHeight;
        
        // Move clouds slightly based on mouse position
        const clouds = document.querySelectorAll('.cloud');
        clouds.forEach((cloud, index) => {
            const speed = (index + 1) * 0.5;
            const x = (mouseX - 0.5) * speed;
            const y = (mouseY - 0.5) * speed;
            cloud.style.transform += ` translate(${x}px, ${y}px)`;
        });
        
        // Move moon slightly
        const moon = document.querySelector('.moon');
        if (moon) {
            const x = (mouseX - 0.5) * 10;
            const y = (mouseY - 0.5) * 10;
            moon.style.transform += ` translate(${x}px, ${y}px)`;
        }
    });
    
    // Add keyboard interactions
    document.addEventListener('keydown', (e) => {
        switch(e.key) {
            case ' ':
                e.preventDefault();
                // Toggle animations
                document.body.classList.toggle('pause-animations');
                break;
            case 's':
                // Toggle stars
                const stars = document.querySelector('.stars');
                if (stars) {
                    stars.style.display = stars.style.display === 'none' ? 'block' : 'none';
                }
                break;
        }
    });
    
    // Add CSS for pause animations
    const pauseStyle = document.createElement('style');
    pauseStyle.textContent = `
        .pause-animations * {
            animation-play-state: paused !important;
        }
    `;
    document.head.appendChild(pauseStyle);
    
    // Performance optimization: Reduce animations on low-end devices
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
        document.body.classList.add('reduced-motion');
    }
    
    // Add reduced motion support
    const reducedMotionStyle = document.createElement('style');
    reducedMotionStyle.textContent = `
        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        }
        
        .reduced-motion * {
            animation-duration: 0.5s !important;
        }
    `;
    document.head.appendChild(reducedMotionStyle);
    
    // Add touch interactions for mobile
    let touchStartY = 0;
    document.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    });
    
    document.addEventListener('touchmove', (e) => {
        const touchY = e.touches[0].clientY;
        const deltaY = touchStartY - touchY;
        
        // Add subtle parallax effect on touch
        const clouds = document.querySelectorAll('.cloud');
        clouds.forEach((cloud, index) => {
            const speed = (index + 1) * 0.1;
            cloud.style.transform += ` translateY(${deltaY * speed}px)`;
        });
    });
    
    console.log('🌕 Mid-Autumn Festival page loaded successfully!');
    console.log('💡 Press SPACE to pause/resume animations');
    console.log('💡 Press S to toggle stars');
});
