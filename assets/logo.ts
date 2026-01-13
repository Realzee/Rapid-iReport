const svgLogo = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 125">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#3B82F6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2563EB;stop-opacity:1" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <g transform="translate(0, 10)">
    <path fill="url(#grad1)" stroke="#60A5FA" stroke-width="2" d="M50 5 L95 25 L95 75 L50 95 L5 75 L5 25 Z" filter="url(#glow)"/>
    <text x="50" y="60" font-family="Roboto, sans-serif" font-size="32" font-weight="bold" fill="white" text-anchor="middle">iR</text>
  </g>
</svg>
`;

// Encode the SVG string into a Base64 data URL to be used in image tags
export const logoUrl = `data:image/svg+xml;base64,${btoa(svgLogo)}`;
