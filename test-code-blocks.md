# Code Block Test Page

Test executable code blocks with Python and Web (HTML/CSS/JS).

## Python Test — Random Number Generator

```exec
--- random_gen.py [python] ---
import random

numbers = [random.randint(1, 100) for _ in range(10)]
print("🎲 Random Numbers:", numbers)
print(f"   Sum: {sum(numbers)}")
print(f"   Avg: {sum(numbers) / len(numbers):.1f}")
print(f"   Min: {min(numbers)}  Max: {max(numbers)}")
```

## Web Test — Confetti Button

```exec
--- index.html [html] ---
<div class="container">
  <h1>🎉 Confetti Lab</h1>
  <p>Click the button to celebrate.</p>
  <button id="boom" onclick="explode()">Explode Confetti</button>
  <canvas id="canvas"></canvas>
</div>

--- style.css [css] ---
* { margin: 0; box-sizing: border-box; }
body { background: #0a0e1a; color: #c0caf5; font-family: system-ui; }
.container { display: flex; flex-direction: column; align-items: center; padding: 40px 20px; gap: 16px; }
h1 { font-size: 24px; }
p { color: #6b7394; font-size: 14px; }
#boom {
  padding: 12px 32px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #7aa2f7, #bb9af7);
  color: #0a0e1a;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
#boom:hover { transform: scale(1.05); box-shadow: 0 4px 20px rgba(122, 162, 247, 0.3); }
#boom:active { transform: scale(0.97); }
#canvas { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }

--- app.js [js] ---
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const colors = ['#7aa2f7', '#bb9af7', '#9ece6a', '#f7768e', '#ff9e64', '#7dcfff', '#e0af68'];
let particles = [];

class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 16;
    this.vy = (Math.random() - 0.5) * 16 - 6;
    this.gravity = 0.25;
    this.size = Math.random() * 8 + 3;
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.rotation = Math.random() * 360;
    this.rotationSpeed = (Math.random() - 0.5) * 12;
    this.opacity = 1;
    this.decay = Math.random() * 0.015 + 0.005;
    this.shape = Math.random() > 0.5 ? 'rect' : 'circle';
  }
  update() {
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.99;
    this.rotation += this.rotationSpeed;
    this.opacity -= this.decay;
  }
  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation * Math.PI / 180);
    ctx.globalAlpha = Math.max(0, this.opacity);
    ctx.fillStyle = this.color;
    if (this.shape === 'rect') {
      ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size * 0.6);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function explode() {
  const btn = document.getElementById('boom');
  const rect = btn.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  for (let i = 0; i < 80; i++) {
    particles.push(new Particle(cx, cy));
  }
  btn.textContent = '🎉 Again!';
}

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles = particles.filter(p => p.opacity > 0);
  particles.forEach(p => { p.update(); p.draw(); });
  requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

console.log('Confetti engine loaded ✨');
```
