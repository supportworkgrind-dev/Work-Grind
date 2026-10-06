const fs = require('fs');
const path = require('path');
const f = path.join(__dirname, '../src/utils/email.ts');
let c = fs.readFileSync(f, 'utf8');

const oldStart = c.indexOf('<svg width="44" height="44"');
if (oldStart === -1) { console.log('Old SVG not found — already updated'); process.exit(0); }

// Find the closing </div> after the </svg>
const svgClose = c.indexOf('</svg>', oldStart);
const divClose = c.indexOf('</div>', svgClose) + '</div>'.length;

const newBlock = [
  '<svg width="44" height="44" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">',
  '                <defs>',
  '                  <linearGradient id="wg-em" x1="4" y1="28" x2="52" y2="28" gradientUnits="userSpaceOnUse">',
  '                    <stop offset="0%" stop-color="#818cf8"/>',
  '                    <stop offset="48%" stop-color="#a78bfa"/>',
  '                    <stop offset="100%" stop-color="#60a5fa"/>',
  '                  </linearGradient>',
  '                  <linearGradient id="wg-ed" x1="24" y1="5" x2="32" y2="12" gradientUnits="userSpaceOnUse">',
  '                    <stop offset="0%" stop-color="#c4b5fd"/>',
  '                    <stop offset="100%" stop-color="#93c5fd"/>',
  '                  </linearGradient>',
  '                </defs>',
  '                <polyline points="4,46 15,16 22,34 28,8 34,34 41,16 52,46" stroke="url(#wg-em)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  '                <circle cx="28" cy="8" r="2.8" fill="url(#wg-ed)"/>',
  '              </svg>',
  '              <span style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.04em;">WorkGrind</span>',
  '            </div>'
].join('\n');

c = c.substring(0, oldStart) + newBlock + c.substring(divClose);
fs.writeFileSync(f, c, 'utf8');
console.log('Email logo updated to WorkGrind W-mark');
