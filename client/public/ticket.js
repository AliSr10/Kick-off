document.addEventListener('DOMContentLoaded', () => {
  const token = new URLSearchParams(window.location.search).get('token');
  const ticketData = { id: 'KFK-UNKNOWN', name: 'GUEST PLAYER', date: 'DATE PENDING', time: '--:--', statusLabel: 'UNVERIFIED PASS' };
  const controls = [...document.querySelectorAll('.pass-action')];
  function setStatus(label, message) {
    for (const element of document.querySelectorAll('.verified-status, .export-valid')) {
      const dot = element.querySelector('.dot, .export-valid-dot')?.cloneNode(true);
      element.replaceChildren(...(dot ? [dot] : []), document.createTextNode(label));
      element.title = message;
    }
  }
  function unavailable(message) {
    setStatus('UNVERIFIED PASS', message);
    controls.forEach(button => { button.disabled = true; });
  }
  function applyTicket(record) {
    const past = record.ends_at && new Date(record.ends_at).getTime() < Date.now();
    const label = record.status === 'CONFIRMED' ? (past ? 'MATCH COMPLETED' : 'VALID RESERVATION')
      : record.status === 'CANCELLED' ? 'CANCELLED' : 'PENDING APPROVAL';
    Object.assign(ticketData, record, { date: new Date(`${record.date}T12:00:00`).toDateString(), statusLabel: label });
    for (const prefix of ['p', 'export']) for (const field of ['id', 'name', 'date', 'time']) {
      const element = document.getElementById(`${prefix}-${field}`);
      if (element) element.textContent = ticketData[field];
    }
    setStatus(label, record.status === 'PENDING' ? 'A request holds no slot until staff confirms it.' : 'Current status checked against the booking database.');
    controls.forEach(button => { button.disabled = false; });
  }
  async function refreshStatus() {
    if (document.hidden) return;
    try { applyTicket((await window.Kickoff.api(`/api/tickets/${encodeURIComponent(token)}`)).reservation); }
    catch (error) { unavailable(error.message || 'We could not verify this pass.'); }
  }
  if (token) {
    refreshStatus();
    setInterval(refreshStatus, 30000);
    document.addEventListener('visibilitychange', refreshStatus);
  } else unavailable('Open the secure pass from your account or ask staff for an updated link.');

/* Visible interactive ticket */

document.getElementById('p-id').textContent =
  ticketData.id;

document.getElementById('p-name').textContent =
  ticketData.name;

document.getElementById('p-date').textContent =
  ticketData.date;

document.getElementById('p-time').textContent =
  ticketData.time;


/* Portrait saved ticket */

document.getElementById('export-id').textContent =
  ticketData.id;

document.getElementById('export-name').textContent =
  ticketData.name;

document.getElementById('export-date').textContent =
  ticketData.date;

document.getElementById('export-time').textContent =
  ticketData.time;

  // ==========================================================================
// MATCH PASS EXPORT ENGINE
// ==========================================================================

const saveTicketBtn =
  document.getElementById('saveTicketBtn');

const animatedPassBtn =
  document.getElementById('animatedPassBtn');

const shareTicketBtn =
  document.getElementById('shareTicketBtn');

const exportTicket =
  document.getElementById('ticketExport');


function canvasToBlob(
  canvas,
  type = 'image/png',
  quality = 1
) {

  return new Promise((resolve) => {

    canvas.toBlob(
      resolve,
      type,
      quality
    );

  });

}


function downloadBlob(blob, filename) {

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement('a');

  link.href =
    url;

  link.download =
    filename;

  document.body.appendChild(link);

  link.click();

  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);

}


/* ---------------------------------------------------------
   Render dedicated 1080 × 1920 ticket
   --------------------------------------------------------- */

async function renderPortraitTicket() {

  // Wait until Google fonts are ready
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const canvas = document.createElement('canvas');

  canvas.width = 1080;
  canvas.height = 1920;

  const ctx = canvas.getContext('2d');

  const W = canvas.width;
  const H = canvas.height;

  // =====================================================
  // BACKGROUND
  // =====================================================

  ctx.fillStyle = '#050807';
  ctx.fillRect(0, 0, W, H);


  // Main soft green stadium glow

  const mainGlow = ctx.createRadialGradient(
    W / 2,
    250,
    20,
    W / 2,
    500,
    900
  );

  mainGlow.addColorStop(
    0,
    'rgba(105, 155, 128, 0.65)'
  );

  mainGlow.addColorStop(
    0.35,
    'rgba(26, 55, 41, 0.45)'
  );

  mainGlow.addColorStop(
    1,
    'rgba(5, 8, 7, 0)'
  );

  ctx.fillStyle = mainGlow;

  ctx.fillRect(
    0,
    0,
    W,
    H
  );


  // =====================================================
  // LIGHT BEAMS
  // =====================================================

  ctx.save();

  ctx.globalAlpha = 0.1;

  const leftBeam = ctx.createLinearGradient(
    100,
    0,
    500,
    1300
  );

  leftBeam.addColorStop(
    0,
    'rgba(0,255,102,0.7)'
  );

  leftBeam.addColorStop(
    1,
    'rgba(0,255,102,0)'
  );

  ctx.fillStyle = leftBeam;

  ctx.beginPath();

  ctx.moveTo(
    120,
    0
  );

  ctx.lineTo(
    370,
    0
  );

  ctx.lineTo(
    700,
    1550
  );

  ctx.lineTo(
    430,
    1550
  );

  ctx.closePath();

  ctx.fill();


  ctx.restore();


  // =====================================================
  // AMBIENT PARTICLES
  // =====================================================

  for (let i = 0; i < 55; i++) {

    const x =
      Math.random() * W;

    const y =
      Math.random() * H;

    const r =
      Math.random() * 2.5 + 0.7;

    const opacity =
      Math.random() * 0.28 + 0.06;

    ctx.beginPath();

    ctx.arc(
      x,
      y,
      r,
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      `rgba(0,255,102,${opacity})`;

    ctx.fill();

  }


  // =====================================================
  // HELPERS
  // =====================================================

  function centerText(
    text,
    y,
    font,
    color = '#FFFFFF',
    letterSpacing = 0
  ) {

    ctx.font = font;

    ctx.fillStyle =
      color;

    ctx.textAlign =
      'center';

    ctx.textBaseline =
      'middle';


    if (!letterSpacing) {

      ctx.fillText(
        text,
        W / 2,
        y
      );

      return;

    }


    const chars =
      [...text];


    const widths =
      chars.map(
        char =>
          ctx.measureText(char).width
      );


    const total =
      widths.reduce(
        (a, b) => a + b,
        0
      ) +
      letterSpacing *
      (chars.length - 1);


    let x =
      W / 2 -
      total / 2;


    chars.forEach(
      (char, index) => {

        ctx.fillText(
          char,
          x +
          widths[index] / 2,
          y
        );

        x +=
          widths[index] +
          letterSpacing;

      }
    );

  }


  // =====================================================
  // BRAND
  // =====================================================

  centerText(
    'KICKOFF OS',
    165,
    '800 22px Inter',
    '#829089',
    7
  );


  centerText(
    'MATCH PASS',
    225,
    '800 62px Rajdhani',
    '#FFFFFF',
    8
  );


  // Small accent line

  const topLine =
    ctx.createLinearGradient(
      390,
      0,
      690,
      0
    );

  topLine.addColorStop(
    0,
    'rgba(0,255,102,0)'
  );

  topLine.addColorStop(
    0.5,
    'rgba(0,255,102,0.8)'
  );

  topLine.addColorStop(
    1,
    'rgba(0,255,102,0)'
  );


  ctx.fillStyle =
    topLine;

  ctx.fillRect(
    390,
    280,
    300,
    2
  );


  // =====================================================
  // TICKET ID
  // =====================================================

  ctx.shadowColor =
    'rgba(0,255,102,0.5)';

  ctx.shadowBlur =
    22;


  centerText(
    ticketData.id,
    370,
    '700 34px "Space Mono"',
    '#00FF66'
  );


  ctx.shadowBlur =
    0;


  // =====================================================
  // PLAYER
  // =====================================================

  centerText(
    'PLAYER',
    525,
    '800 20px Inter',
    '#83918A',
    7
  );


  // Preserve the original single-line style and fit longer names inside the saved pass.
  const playerName = ticketData.name.toUpperCase();
  function nameWidth(text) {
    return [...text].reduce((sum, char) => sum + ctx.measureText(char).width, 0) + Math.max(0, [...text].length - 1) * 2;
  }
  function nameLines(size) {
    ctx.font = `800 ${size}px Rajdhani`;
    const lines = []; let line = '';
    for (const word of playerName.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (nameWidth(candidate) <= 864) { line = candidate; continue; }
      if (line) { lines.push(line); line = ''; }
      for (const char of word) {
        if (line && nameWidth(line + char) > 864) { lines.push(line); line = char; }
        else line += char;
      }
    }
    if (line) lines.push(line);
    return lines;
  }
  ctx.font = '800 74px Rajdhani';
  if (nameWidth(playerName) <= 864) centerText(playerName, 600, '800 74px Rajdhani', '#FFFFFF', 2);
  else {
    let size = 74, lines = nameLines(size);
    while (size > 20 && (lines.length > 3 || lines.length * size + (lines.length - 1) * 4 > 136)) lines = nameLines(size -= 2);
    lines.forEach((line, index) => centerText(line, 548 + size + index * (size + 4), `800 ${size}px Rajdhani`, '#FFFFFF', 2));
  }


  // =====================================================
  // DIVIDER
  // =====================================================

  const divider =
    ctx.createLinearGradient(
      390,
      0,
      690,
      0
    );


  divider.addColorStop(
    0,
    'rgba(0,255,102,0)'
  );

  divider.addColorStop(
    0.5,
    'rgba(0,255,102,0.7)'
  );

  divider.addColorStop(
    1,
    'rgba(0,255,102,0)'
  );


  ctx.fillStyle =
    divider;


  ctx.fillRect(
    390,
    700,
    300,
    2
  );


  // =====================================================
  // KICKOFF
  // =====================================================

  centerText(
    'KICKOFF WINDOW',
    805,
    '800 20px Inter',
    '#83918A',
    7
  );


  centerText(
    ticketData.date.toUpperCase(),
    880,
    '700 47px Rajdhani',
    '#FFFFFF'
  );


  ctx.shadowColor =
    'rgba(0,255,102,0.40)';

  ctx.shadowBlur =
    35;


  centerText(
    ticketData.time.toUpperCase(),
    990,
    '800 79px Rajdhani',
    '#00FF66'
  );


  ctx.shadowBlur =
    0;


  // =====================================================
  // VENUE
  // =====================================================

  centerText(
    'VENUE',
    1170,
    '800 20px Inter',
    '#83918A',
    7
  );


  centerText(
    'CHOUEIFAT FACILITY',
    1230,
    '700 37px Rajdhani',
    '#A0AAA5'
  );


  centerText(
    'PITCH 1',
    1275,
    '700 32px Rajdhani',
    '#77827C'
  );


  // =====================================================
  // VALID RESERVATION BUTTON
  // =====================================================

  const pillWidth =
    470;

  const pillHeight =
    86;

  const pillX =
    (W - pillWidth) / 2;

  const pillY =
    1410;


  ctx.save();


  ctx.shadowColor =
    'rgba(0,255,102,0.35)';

  ctx.shadowBlur =
    35;


  ctx.fillStyle =
    '#00FF66';


  ctx.beginPath();


  ctx.roundRect(
    pillX,
    pillY,
    pillWidth,
    pillHeight,
    pillHeight / 2
  );


  ctx.fill();


  ctx.restore();


  // Dot

  ctx.beginPath();

  ctx.arc(
    pillX + 48,
    pillY + pillHeight / 2,
    8,
    0,
    Math.PI * 2
  );

  ctx.fillStyle =
    '#020503';

  ctx.fill();


  ctx.font =
    '700 24px "Space Mono"';

  ctx.fillStyle =
    '#020503';

  ctx.textAlign =
    'center';

  ctx.textBaseline =
    'middle';


  ctx.fillText(
    ticketData.statusLabel,
    W / 2 + 15,
    pillY + pillHeight / 2
  );


  // =====================================================
  // FOOTER
  // =====================================================

  ctx.textAlign =
    'left';

  ctx.font =
    '700 16px "Space Mono"';

  ctx.fillStyle =
    'rgba(255,255,255,0.25)';


  ctx.fillText(
    'KICKOFF CHOUEIFAT',
    70,
    1810
  );


  ctx.textAlign =
    'right';


  ctx.fillText(
    'OFFICIAL DIGITAL MATCH PASS',
    W - 70,
    1810
  );


  return canvas;
}


/* =========================================================
   SAVE PERMANENT PNG
   ========================================================= */

saveTicketBtn.addEventListener(
  'click',
  async () => {

    const original =
      saveTicketBtn.innerHTML;

    saveTicketBtn.disabled =
      true;

    saveTicketBtn.innerHTML =
      `
        <span class="action-icon">◌</span>

        <span class="action-copy">
          <strong>CREATING PASS...</strong>
          <small>Preparing high-resolution ticket</small>
        </span>
      `;

    try {

      const canvas =
        await renderPortraitTicket();

      const blob =
        await canvasToBlob(
          canvas,
          'image/png',
          1
        );

      downloadBlob(
        blob,
        `${ticketData.id}-MATCH-PASS.png`
      );

    } catch (error) {

  console.error(
    'TICKET EXPORT ERROR:',
    error
  );

  alert(
    `Ticket error: ${error.message}`
  );

}finally {

      saveTicketBtn.disabled =
        false;

      saveTicketBtn.innerHTML =
        original;

    }

  }
);


/* =========================================================
   SHARE TICKET
   ========================================================= */

shareTicketBtn.addEventListener(
  'click',
  async () => {

    const original =
      shareTicketBtn.innerHTML;

    shareTicketBtn.disabled =
      true;

    shareTicketBtn.textContent =
      'PREPARING...';

    try {

      const canvas =
        await renderPortraitTicket();

      const blob =
        await canvasToBlob(
          canvas,
          'image/png',
          1
        );

      const file =
        new File(
          [blob],
          `${ticketData.id}-MATCH-PASS.png`,
          {
            type: 'image/png'
          }
        );


      /* Native phone share sheet */

      if (
        navigator.share &&
        (!navigator.canShare ||
        navigator.canShare({
          files: [file]
        }))
      ) {

        await navigator.share({

          title:
            'KICKOFF Match Pass',

          text:
            `${ticketData.name} • ${ticketData.date} • ${ticketData.time}`,

          files:
            [file]

        });

      }

      /* Desktop / unsupported browser fallback */

      else {

        downloadBlob(
          blob,
          `${ticketData.id}-MATCH-PASS.png`
        );

        alert(
          'Your Match Pass was saved. You can now share it from your device.'
        );

      }

    } catch (error) {

      /*
       User cancelling the share sheet is normal,
       so don't show an error for AbortError.
      */

      if (error.name !== 'AbortError') {

        console.error(error);

        alert(
          'Sharing is not available on this device.'
        );

      }

    } finally {

      shareTicketBtn.disabled =
        false;

      shareTicketBtn.innerHTML =
        original;

    }

  }
);


/* =========================================================
   ANIMATED MATCH PASS
   ========================================================= */

animatedPassBtn.addEventListener(
  'click',
  async () => {

    if (
      !window.MediaRecorder ||
      !HTMLCanvasElement.prototype.captureStream
    ) {

      alert(
        'Animated Pass recording is not supported by this browser. You can still save the normal Match Pass.'
      );

      return;

    }


    const original =
      animatedPassBtn.innerHTML;

    animatedPassBtn.disabled =
      true;

    animatedPassBtn.textContent =
      'CREATING VIDEO...';


    try {

      /*
       Render the portrait ticket ONCE.

       The animation then happens on canvas,
       which is much faster than repeatedly
       screenshotting the webpage.
      */

      const baseCanvas =
        await renderPortraitTicket();


      const videoCanvas =
        document.createElement('canvas');

      videoCanvas.width =
        1080;

      videoCanvas.height =
        1920;


      const ctx =
        videoCanvas.getContext('2d');


      const FPS =
        24;

      const DURATION =
        5000;


      const stream =
        videoCanvas.captureStream(FPS);


      const supportedTypes = [

        'video/mp4;codecs=avc1.42E01E',

        'video/mp4',

        'video/webm;codecs=vp9',

        'video/webm;codecs=vp8',

        'video/webm'

      ];


      const mimeType =
        supportedTypes.find(type =>
          MediaRecorder.isTypeSupported(type)
        );


      if (!mimeType) {

        throw new Error(
          'No supported video recording format.'
        );

      }


      const extension =
        mimeType.includes('mp4')
          ? 'mp4'
          : 'webm';


      const recorder =
        new MediaRecorder(
          stream,
          {

            mimeType,

            videoBitsPerSecond:
              8000000

          }
        );


      const chunks =
        [];


      recorder.ondataavailable =
        event => {

          if (event.data.size > 0) {

            chunks.push(
              event.data
            );

          }

        };


      const finishedRecording =
        new Promise(
          (resolve, reject) => {

            recorder.onstop =
              () => {

                resolve(

                  new Blob(
                    chunks,
                    {
                      type:
                        mimeType
                    }
                  )

                );

              };


            recorder.onerror =
              reject;

          }
        );


      /* -------------------------------
         Animated particle configuration
         ------------------------------- */

      const particles =
        Array.from(
          { length: 45 },
          () => ({

            x:
              Math.random() *
              1080,

            y:
              Math.random() *
              1920,

            radius:
              Math.random() * 3 + 1,

            speed:
              Math.random() * 14 + 8,

            alpha:
              Math.random() * 0.35 + 0.1

          })
        );


      recorder.start();


      const start =
        performance.now();


      function drawFrame(now) {

        const elapsed =
          now - start;


        const progress =
          Math.min(
            elapsed / DURATION,
            1
          );


        const seconds =
          elapsed / 1000;


        ctx.clearRect(
          0,
          0,
          1080,
          1920
        );


        /* Slow cinematic push */

        const zoom =
          1 +
          Math.sin(
            progress *
            Math.PI
          ) *
          0.018;


        ctx.save();


        ctx.translate(
          540,
          960
        );


        ctx.scale(
          zoom,
          zoom
        );


        ctx.drawImage(
          baseCanvas,
          -540,
          -960,
          1080,
          1920
        );


        ctx.restore();


        /* Animated green ambient glow */

        const glow =
          ctx.createRadialGradient(
            540,
            650,
            30,
            540,
            650,
            650
          );


        const glowPulse =
          0.06 +
          Math.sin(
            seconds * 2
          ) * 0.018;


        glow.addColorStop(
          0,
          `rgba(0,255,102,${glowPulse})`
        );


        glow.addColorStop(
          1,
          'rgba(0,255,102,0)'
        );


        ctx.fillStyle =
          glow;


        ctx.fillRect(
          0,
          0,
          1080,
          1920
        );


        /* Floating stadium particles */

        particles.forEach(
          particle => {

            particle.y -=
              particle.speed / FPS;


            if (
              particle.y < -10
            ) {

              particle.y =
                1930;

              particle.x =
                Math.random() *
                1080;

            }


            ctx.beginPath();


            ctx.arc(
              particle.x,
              particle.y,
              particle.radius,
              0,
              Math.PI * 2
            );


            ctx.fillStyle =
              `rgba(0,255,102,${particle.alpha})`;


            ctx.fill();

          }
        );


        /* Cinematic scanning laser */

        const scanCycle =
          (seconds % 2.5) /
          2.5;


        const laserY =
          scanCycle *
          1920;


        const laser =
          ctx.createLinearGradient(
            0,
            laserY - 100,
            0,
            laserY + 100
          );


        laser.addColorStop(
          0,
          'rgba(0,255,102,0)'
        );


        laser.addColorStop(
          0.5,
          'rgba(0,255,102,0.45)'
        );


        laser.addColorStop(
          1,
          'rgba(0,255,102,0)'
        );


        ctx.fillStyle =
          laser;


        ctx.fillRect(
          0,
          laserY - 100,
          1080,
          200
        );


        ctx.fillStyle =
          'rgba(0,255,102,0.9)';


        ctx.fillRect(
          0,
          laserY,
          1080,
          3
        );


        if (
          elapsed <
          DURATION
        ) {

          requestAnimationFrame(
            drawFrame
          );

        }

        else {

          recorder.stop();

        }

      }


      requestAnimationFrame(
        drawFrame
      );


      const videoBlob =
        await finishedRecording;


      downloadBlob(
        videoBlob,
        `${ticketData.id}-ANIMATED-PASS.${extension}`
      );


    } catch (error) {

      console.error(error);

      alert(
        'Animated Pass could not be created on this browser.'
      );

    } finally {

      animatedPassBtn.disabled =
        false;

      animatedPassBtn.innerHTML =
        original;

    }

  }
);

      // ----------------------------------------------------------------------
      // 2. PARALLAX & 3D MOTION ENGINE
      // ----------------------------------------------------------------------
      const passWrapper = document.getElementById('passWrapper');
      const stadiumEnv = document.getElementById('stadiumEnv');
      
      let targetX = 0;
      let targetY = 0;
      let currentX = 0;
      let currentY = 0;
      const ease = 0.05; // Smoothing factor

      // Animation loop for smooth interpolation
      function renderMotion() {
        // Stop custom motion if user prefers reduced motion
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        currentX += (targetX - currentX) * ease;
        currentY += (targetY - currentY) * ease;

        // Apply 3D rotation to the Pass (Moves opposite to tilt)
        passWrapper.style.transform = `rotateX(${currentY * -15}deg) rotateY(${currentX * 15}deg)`;
        
        // Apply Parallax Pan to the Stadium Environment (Moves with tilt)
        stadiumEnv.style.transform = `translateX(${currentX * -20}px) translateY(${currentY * -20}px)`;

        requestAnimationFrame(renderMotion);
      }

      // Start motion engine
      requestAnimationFrame(renderMotion);

      // Mouse Parallax for Desktop
      window.addEventListener('mousemove', (e) => {
        // Normalize mouse coordinates from -1 to 1
        targetX = (e.clientX / window.innerWidth) * 2 - 1;
        targetY = (e.clientY / window.innerHeight) * 2 - 1;
        // Kill the CSS default breathing animation once user interacts
        passWrapper.style.animation = 'none'; 
      });

      // Gyroscope Parallax for Mobile (QR Scanners)
      if (window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', (e) => {
          if (e.gamma !== null && e.beta !== null) {
            // Gamma: left/right tilt (-90 to 90) -> Normalize to -1 to 1
            targetX = Math.max(-1, Math.min(1, e.gamma / 45)); 
            // Beta: front/back tilt (-180 to 180) -> Normalize to -1 to 1 (Assuming resting angle ~45deg)
            targetY = Math.max(-1, Math.min(1, (e.beta - 45) / 45));
            passWrapper.style.animation = 'none';
          }
        });
      }

      // ----------------------------------------------------------------------
      // 3. AMBIENT PARTICLES (STADIUM DUST)
      // ----------------------------------------------------------------------
      const canvas = document.getElementById('ambientCanvas');
      if (canvas && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const ctx = canvas.getContext('2d');
        let width, height;
        let particles = [];

        function initParticles() {
          width = canvas.width = window.innerWidth;
          height = canvas.height = window.innerHeight;
          particles = [];
          // Fewer particles for mobile performance
          const particleCount = window.innerWidth < 768 ? 25 : 50;
          for (let i = 0; i < particleCount; i++) {
            particles.push({
              x: Math.random() * width,
              y: Math.random() * height,
              size: Math.random() * 1.5 + 0.5,
              speedY: (Math.random() - 1.5) * 0.3, // Slowly floating UP like stadium dust
              speedX: (Math.random() - 0.5) * 0.2,
              opacity: Math.random() * 0.4 + 0.1
            });
          }
        }

        function drawParticles() {
          ctx.clearRect(0, 0, width, height);
          particles.forEach(p => {
            p.y += p.speedY;
            p.x += p.speedX;
            // Wrap around edges
            if (p.y < -10) p.y = height + 10;
            if (p.x < -10) p.x = width + 10;
            if (p.x > width + 10) p.x = -10;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 255, 102, ${p.opacity})`;
            ctx.fill();
          });
          requestAnimationFrame(drawParticles);
        }

        window.addEventListener('resize', initParticles);
        initParticles();
        drawParticles();
      }
    });
  