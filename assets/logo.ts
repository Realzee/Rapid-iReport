// Vigilix Security Monitoring System - Official Branding Assets

export const vigilixSvgBanner = `<svg viewBox="0 0 560 140" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#052e16"/>
      <stop offset="50%" stop-color="#021c0e"/>
      <stop offset="100%" stop-color="#000d06"/>
    </linearGradient>

    <!-- Neon Emerald Gradient -->
    <linearGradient id="neonGreenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4ade80"/>
      <stop offset="50%" stop-color="#22c55e"/>
      <stop offset="100%" stop-color="#15803d"/>
    </linearGradient>

    <!-- Lime / Cyber Accent -->
    <linearGradient id="limeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#a3e635"/>
      <stop offset="50%" stop-color="#22c55e"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>

    <!-- Silver Metallic Gradient for Lettering -->
    <linearGradient id="silverGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="45%" stop-color="#f0fdf4"/>
      <stop offset="70%" stop-color="#cbd5e1"/>
      <stop offset="100%" stop-color="#94a3b8"/>
    </linearGradient>

    <!-- Glow Filter -->
    <filter id="emeraldGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>

    <filter id="intenseGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="5" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <g transform="translate(10, 10)">
    <!-- Shield Emblem Outer Glow -->
    <path d="M 60 4 L 112 24 L 112 76 C 112 104 60 120 60 120 C 60 120 8 104 8 76 L 8 24 Z" 
          fill="none" stroke="#22c55e" stroke-width="3" filter="url(#emeraldGlow)" opacity="0.8"/>
    
    <!-- Shield Inner Fill -->
    <path d="M 60 6 L 110 25 L 110 75 C 110 102 60 117 60 117 C 60 117 10 102 10 75 L 10 25 Z" 
          fill="url(#shieldGrad)" stroke="#15803d" stroke-width="1.5"/>

    <!-- Grid lines inside shield -->
    <path d="M 20 40 L 100 40 M 15 65 L 105 65 M 25 90 L 95 90 M 40 20 L 40 105 M 60 10 L 60 115 M 80 20 L 80 105" 
          stroke="#22c55e" stroke-width="0.75" stroke-dasharray="2,3" opacity="0.25"/>

    <!-- HUD Arc & Radar Elements -->
    <circle cx="60" cy="62" r="38" fill="none" stroke="#22c55e" stroke-width="1.5" stroke-dasharray="8,4" opacity="0.6"/>
    <circle cx="60" cy="62" r="26" fill="none" stroke="#4ade80" stroke-width="1" stroke-dasharray="4,6" opacity="0.7"/>

    <!-- CCTV Camera & Targeting Reticle Motif -->
    <g transform="translate(60, 60)">
      <!-- CCTV Body -->
      <path d="M -18 -8 L 8 -16 L 22 -6 L 22 8 L -18 8 Z" fill="#0f172a" stroke="#22c55e" stroke-width="1.5"/>
      <!-- Sunshield / Cover -->
      <path d="M -22 -10 L 10 -20 L 26 -8" fill="none" stroke="#4ade80" stroke-width="2"/>
      <!-- Camera Lens & Infrared Array -->
      <circle cx="16" cy="1" r="7" fill="#022c22" stroke="#22c55e" stroke-width="1.5"/>
      <circle cx="16" cy="1" r="3.5" fill="#4ade80" filter="url(#intenseGlow)"/>
      <circle cx="16" cy="1" r="1.5" fill="#ffffff"/>
      <!-- Camera Stand -->
      <path d="M -10 8 L -10 20 L -4 20" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round"/>
      
      <!-- Reticle Crosshairs -->
      <line x1="-32" y1="0" x2="-24" y2="0" stroke="#a3e635" stroke-width="2"/>
      <line x1="24" y1="0" x2="32" y2="0" stroke="#a3e635" stroke-width="2"/>
      <line x1="0" y1="-32" x2="0" y2="-24" stroke="#a3e635" stroke-width="2"/>
      <line x1="0" y1="24" x2="0" y2="32" stroke="#a3e635" stroke-width="2"/>
    </g>

    <!-- Glowing Target Corner Brackets -->
    <path d="M 32 36 L 26 36 L 26 42" fill="none" stroke="#a3e635" stroke-width="2"/>
    <path d="M 88 36 L 94 36 L 94 42" fill="none" stroke="#a3e635" stroke-width="2"/>
    <path d="M 26 84 L 26 90 L 32 90" fill="none" stroke="#a3e635" stroke-width="2"/>
    <path d="M 94 84 L 94 90 L 88 90" fill="none" stroke="#a3e635" stroke-width="2"/>
  </g>

  <!-- Typography: VIGILIX -->
  <g transform="translate(136, 18)">
    <!-- Primary VIGILIX Wordmark Shadow -->
    <text x="0" y="58" font-family="'Inter', 'Arial Black', sans-serif" font-weight="900" font-size="54" 
          fill="#022c22" letter-spacing="4">VIGILIX</text>
    
    <!-- Primary VIGILIX Wordmark Glow Outline -->
    <text x="0" y="56" font-family="'Inter', 'Arial Black', sans-serif" font-weight="900" font-size="54" 
          fill="none" stroke="#22c55e" stroke-width="4" letter-spacing="4" filter="url(#emeraldGlow)" opacity="0.7">VIGILIX</text>

    <!-- Primary VIGILIX Wordmark Fill -->
    <text x="0" y="56" font-family="'Inter', 'Arial Black', sans-serif" font-weight="900" font-size="54" 
          fill="url(#silverGrad)" letter-spacing="4">VIGILIX</text>

    <!-- Neon Accent Slash on Initial 'V' -->
    <path d="M 2 12 L 20 54 L 26 54 L 10 12 Z" fill="url(#neonGreenGrad)" opacity="0.9"/>

    <!-- High-Tech Divider Bar -->
    <rect x="0" y="68" width="400" height="3" fill="url(#limeGrad)" rx="1.5" filter="url(#emeraldGlow)"/>
    <polygon points="380,66 400,69.5 380,73" fill="#a3e635"/>

    <!-- Subtitle: SECURITY MONITORING SYSTEM -->
    <g transform="translate(0, 88)">
      <rect x="0" y="-12" width="280" height="18" fill="#022c22" rx="4" stroke="#16a34a" stroke-width="1" opacity="0.6"/>
      <text x="6" y="1" font-family="'Inter', 'Arial', sans-serif" font-weight="800" font-size="11.5" 
            fill="#4ade80" letter-spacing="2.5">SECURITY MONITORING SYSTEM</text>
    </g>

    <!-- Slogan / Precision Tagline -->
    <g transform="translate(0, 108)">
      <text x="0" y="0" font-family="'Inter', 'Arial', sans-serif" font-weight="600" font-size="8.5" 
            fill="#94a3b8" letter-spacing="3.5">SECURITY  •  TECHNOLOGY  •  SPEED</text>
    </g>
  </g>
</svg>`;

export const vigilixSvgSquare = `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="sqBg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#062816"/>
      <stop offset="60%" stop-color="#02140a"/>
      <stop offset="100%" stop-color="#000000"/>
    </radialGradient>

    <linearGradient id="sqShield" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#052e16"/>
      <stop offset="50%" stop-color="#021f10"/>
      <stop offset="100%" stop-color="#000d06"/>
    </linearGradient>

    <linearGradient id="sqNeon" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4ade80"/>
      <stop offset="50%" stop-color="#22c55e"/>
      <stop offset="100%" stop-color="#15803d"/>
    </linearGradient>

    <linearGradient id="sqLime" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#a3e635"/>
      <stop offset="50%" stop-color="#22c55e"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>

    <linearGradient id="sqSilver" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="50%" stop-color="#f0fdf4"/>
      <stop offset="100%" stop-color="#94a3b8"/>
    </linearGradient>

    <filter id="sqGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" fill="url(#sqBg)" rx="96"/>
  <rect width="100%" height="100%" fill="none" stroke="#22c55e" stroke-width="4" rx="96" opacity="0.3"/>

  <!-- Tactical Grid -->
  <g stroke="#22c55e" stroke-width="1" opacity="0.15" stroke-dasharray="4,8">
    <line x1="64" y1="0" x2="64" y2="512"/>
    <line x1="128" y1="0" x2="128" y2="512"/>
    <line x1="256" y1="0" x2="256" y2="512"/>
    <line x1="384" y1="0" x2="384" y2="512"/>
    <line x1="448" y1="0" x2="448" y2="512"/>
    <line x1="0" y1="64" x2="512" y2="64"/>
    <line x1="0" y1="128" x2="512" y2="128"/>
    <line x1="0" y1="256" x2="512" y2="256"/>
    <line x1="0" y1="384" x2="512" y2="384"/>
    <line x1="0" y1="448" x2="512" y2="448"/>
  </g>

  <!-- Central Shield -->
  <g transform="translate(256, 175) scale(1.45)">
    <path d="M 0 -75 L 68 -48 L 68 18 C 68 62 0 88 0 88 C 0 88 -68 62 -68 18 L -68 -48 Z" 
          fill="none" stroke="#22c55e" stroke-width="4" filter="url(#sqGlow)"/>
    <path d="M 0 -72 L 64 -46 L 64 16 C 64 58 0 84 0 84 C 0 84 -64 58 -64 16 L -64 -46 Z" 
          fill="url(#sqShield)" stroke="#16a34a" stroke-width="2"/>

    <!-- Radar Rings -->
    <circle cx="0" cy="0" r="48" fill="none" stroke="#22c55e" stroke-width="2" stroke-dasharray="8,6" opacity="0.6"/>
    <circle cx="0" cy="0" r="32" fill="none" stroke="#a3e635" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.7"/>

    <!-- CCTV Camera & Target Crosshairs -->
    <g transform="translate(0, 0)">
      <path d="M -22 -10 L 10 -20 L 28 -8 L 28 10 L -22 10 Z" fill="#0f172a" stroke="#22c55e" stroke-width="2"/>
      <path d="M -26 -12 L 12 -24 L 32 -10" fill="none" stroke="#4ade80" stroke-width="2.5"/>
      <circle cx="20" cy="1" r="9" fill="#022c22" stroke="#22c55e" stroke-width="2"/>
      <circle cx="20" cy="1" r="4.5" fill="#4ade80" filter="url(#sqGlow)"/>
      <circle cx="20" cy="1" r="2" fill="#ffffff"/>
      <path d="M -12 10 L -12 26 L -4 26" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round"/>
      <line x1="-40" y1="0" x2="-30" y2="0" stroke="#a3e635" stroke-width="2.5"/>
      <line x1="30" y1="0" x2="40" y2="0" stroke="#a3e635" stroke-width="2.5"/>
      <line x1="0" y1="-40" x2="0" y2="-30" stroke="#a3e635" stroke-width="2.5"/>
      <line x1="0" y1="30" x2="0" y2="40" stroke="#a3e635" stroke-width="2.5"/>
    </g>
  </g>

  <!-- Wordmark: VIGILIX -->
  <g transform="translate(256, 360)">
    <text x="0" y="0" font-family="'Inter', 'Arial Black', sans-serif" font-weight="900" font-size="58" 
          fill="url(#sqSilver)" text-anchor="middle" letter-spacing="6">VIGILIX</text>
    <text x="0" y="0" font-family="'Inter', 'Arial Black', sans-serif" font-weight="900" font-size="58" 
          fill="none" stroke="#22c55e" stroke-width="3" text-anchor="middle" letter-spacing="6" filter="url(#sqGlow)" opacity="0.6">VIGILIX</text>
  </g>

  <!-- Subtitle Ribbon -->
  <g transform="translate(256, 405)">
    <rect x="-170" y="-14" width="340" height="24" fill="#022c22" rx="6" stroke="#22c55e" stroke-width="1.5"/>
    <text x="0" y="2" font-family="'Inter', 'Arial', sans-serif" font-weight="800" font-size="13" 
          fill="#4ade80" text-anchor="middle" letter-spacing="3">SECURITY MONITORING SYSTEM</text>
  </g>

  <!-- Footer Tagline -->
  <g transform="translate(256, 450)">
    <text x="0" y="0" font-family="'Inter', 'Arial', sans-serif" font-weight="600" font-size="11" 
          fill="#94a3b8" text-anchor="middle" letter-spacing="4">SECURITY • TECHNOLOGY • SPEED</text>
  </g>
</svg>`;

// Convert to high-fidelity SVG data URIs
export const vigilixBannerDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(vigilixSvgBanner)}`;
export const vigilixSquareDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(vigilixSvgSquare)}`;

// Primary exported URLs for components & settings
export const logoUrl = vigilixBannerDataUri;
export const squareAppIconUrl = vigilixSquareDataUri;

// Backwards compatibility alias exports
export const rapid911LogoUrl = vigilixBannerDataUri;
export const svgLogo = vigilixSvgBanner;
export const svgSquareIcon = vigilixSvgSquare;
