export const svgLogo = `
<svg viewBox="0 0 420 120" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="rapidRedGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FF3B30" />
      <stop offset="50%" stop-color="#E11D48" />
      <stop offset="100%" stop-color="#991B1B" />
    </linearGradient>
    <filter id="logoGlow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.3" />
    </filter>
  </defs>
  <!-- Background Badge Container for clean contrast on both dark & light backgrounds -->
  <rect width="100%" height="100%" rx="16" fill="#0A0F1D" stroke="#1E293B" stroke-width="2" />
  
  <!-- Left Side: Rapid Wordmark -->
  <g transform="translate(18, 15)">
    <!-- RAPID text with italicized slant -->
    <text x="5" y="55" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Arial Black', Impact, sans-serif" font-weight="900" font-size="52" fill="#FFFFFF" letter-spacing="-2" transform="skewX(-10)">
      RAP<tspan visibility="hidden">I</tspan>D
    </text>
    
    <!-- Custom stylized 'I' with emergency red accent arrow/chevron -->
    <g transform="skewX(-10)">
      <path d="M140 58 V 12 H 154 V 58 Z" fill="#FFFFFF" />
      <polygon points="154,12 147,12 154,24" fill="#EF4444" />
    </g>

    <!-- Subtitle Badge: RAPID RESCUE SMART DISPATCH -->
    <text x="6" y="80" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="10.5" fill="#94A3B8" letter-spacing="3.5">
      RAPID RESCUE
    </text>
    <text x="6" y="93" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="8.5" fill="#64748B" letter-spacing="1.5">
      COMMUNITY SAFETY SYSTEM
    </text>
  </g>

  <!-- Right Side: Bold 911 Number Badge with vibrant Red Gradient -->
  <g transform="translate(265, 8)">
    <rect x="-8" y="5" width="135" height="92" rx="12" fill="#1E293B" fill-opacity="0.6" stroke="#334155" stroke-width="1" />
    <text x="60" y="72" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Arial Black', Impact, sans-serif" font-weight="900" font-size="64" fill="url(#rapidRedGrad)" style="font-style: italic;" filter="url(#logoGlow)">
      911
    </text>
  </g>
</svg>`;

export const svgSquareIcon = `
<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="sqRedGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FF453A" />
      <stop offset="50%" stop-color="#E11D48" />
      <stop offset="100%" stop-color="#991B1B" />
    </linearGradient>
    <linearGradient id="sqBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F172A" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#sqBgGrad)" stroke="#334155" stroke-width="10" />
  <g transform="translate(48, 80)">
    <!-- RAPID text -->
    <text x="10" y="110" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Arial Black', Impact, sans-serif" font-weight="900" font-size="100" fill="#FFFFFF" letter-spacing="-4" transform="skewX(-10)">
      RAP<tspan visibility="hidden">I</tspan>D
    </text>
    <g transform="skewX(-10)">
      <path d="M272 116 V 26 H 298 V 116 Z" fill="#FFFFFF" />
      <polygon points="298,26 285,26 298,52" fill="#EF4444" />
    </g>

    <!-- 911 in big bold font -->
    <text x="208" y="270" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Arial Black', Impact, sans-serif" font-weight="900" font-size="160" fill="url(#sqRedGrad)" style="font-style: italic;">
      911
    </text>

    <!-- Bottom subtext -->
    <text x="208" y="325" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="22" fill="#94A3B8" letter-spacing="6">
      RAPID RESCUE
    </text>
    <text x="208" y="355" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="600" font-size="16" fill="#64748B" letter-spacing="3">
      COMMUNITY SAFETY
    </text>
  </g>
</svg>`;

// Primary official application saved logo URL
export const logoUrl = 'https://yglwdwhwpbqawunbkzyy.supabase.co/storage/v1/object/public/app-assets/main-logo.png?t=1781074810952';
export const squareAppIconUrl = 'https://yglwdwhwpbqawunbkzyy.supabase.co/storage/v1/object/public/app-assets/main-logo.png?t=1781074810952';


