/**
 * SplitEase Premium Confetti Burst Utility
 * Programmatically spawns a full-screen canvas particle explosion.
 * Ultra-lightweight, high-performance, and has zero external dependencies.
 */
export function triggerConfetti() {
  const canvas = document.createElement('canvas');
  canvas.id = 'premium-confetti-canvas';
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.zIndex = '99999';
  canvas.style.pointerEvents = 'none';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const colors = [
    '#6c5ce7', '#00cec9', '#ff6b6b', '#feca57', '#54a0ff',
    '#ff9ff3', '#5f27cd', '#01a3a4', '#f368e0', '#ff9f43'
  ];

  const particles = [];
  const particleCount = 130;

  // Create particles spawning from both bottom corners launching towards the center
  for (let i = 0; i < particleCount; i++) {
    const isLeft = i % 2 === 0;
    particles.push({
      x: isLeft ? 0 : width,
      y: height * 0.9,
      vx: (isLeft ? 1 : -1) * (Math.random() * 8 + 6),
      vy: -(Math.random() * 12 + 10),
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 6,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.15,
      opacity: 1,
      gravity: 0.35,
      friction: 0.98,
      shape: Math.random() > 0.5 ? 'circle' : 'rect'
    });
  }

  const startTime = Date.now();
  const duration = 2200; // 2.2 seconds

  function animate() {
    const elapsed = Date.now() - startTime;
    if (elapsed > duration) {
      canvas.remove();
      return;
    }

    ctx.clearRect(0, 0, width, height);

    particles.forEach((p) => {
      // Physics calculations
      p.vx *= p.friction;
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;

      // Start fading out in the second half of animation
      if (elapsed > duration * 0.5) {
        const fadeRatio = (elapsed - duration * 0.5) / (duration * 0.5);
        p.opacity = Math.max(0, 1 - fadeRatio);
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;

      ctx.beginPath();
      if (p.shape === 'circle') {
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      }
      ctx.restore();
    });

    requestAnimationFrame(animate);
  }

  animate();
}
