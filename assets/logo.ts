const svgLogo = `
<svg viewBox="0 0 420 160" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="black" />
  <!-- White "RAPID" text. Italicized via skewX transform. -->
  <!-- We hide the original 'I' and draw a custom one. -->
  <text x="10" y="60" font-family="'Arial Black', 'Impact', sans-serif" font-weight="900" font-size="70" fill="white" letter-spacing="-5" transform="skewX(-10)">
    RAP<tspan visibility="hidden">I</tspan>D
  </text>
  
  <!-- Custom "I" with red detail to mimic the original logo -->
  <g transform="skewX(-10)">
    <path d="M185 62 V 4 H 200 V 62 Z" fill="white"/>
    <path d="M200 4 L192 4 L200 20 Z" fill="#EF4444"/>
  </g>

  <!-- Red "911" text with gradient -->
  <g transform="translate(150, 45)">
    <defs>
      <linearGradient id="redGradFinal" x1="0.5" y1="0" x2="0.5" y2="1">
        <stop offset="0%" stop-color="#FF5555" />
        <stop offset="50%" stop-color="#DD2222" />
        <stop offset="100%" stop-color="#AA0000" />
      </linearGradient>
    </defs>
    <text
      x="0"
      y="60"
      font-family="'Arial Black', 'Impact', sans-serif"
      font-weight="900"
      font-size="85"
      fill="url(#redGradFinal)"
      stroke="#440000"
      stroke-width="1"
      style="font-style: italic;"
    >
      911
    </text>
  </g>
  
  <!-- Subtext below "911" -->
  <g transform="translate(170, 130)">
    <text font-family="'Arial', sans-serif" font-weight="bold" font-size="12" fill="white" letter-spacing="2">RAPID RESCUE</text>
    <text y="15" font-family="'Arial', sans-serif" font-size="10" fill="#cccccc" letter-spacing="1">SMART EMERGENCY ALERT</text>
  </g>
</svg>`;

// Encode the SVG string into a Base64 data URL to be used in image tags
export const logoUrl = `data:image/svg+xml;base64,${btoa(encodeURIComponent(svgLogo).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode(parseInt(p1, 16))))}`;