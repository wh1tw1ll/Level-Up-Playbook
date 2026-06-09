var fs = require('fs');
var src = fs.readFileSync('app.js');
console.log('First 5 bytes hex:', src.slice(0,5).toString('hex'));
console.log('File size:', src.length);
// Check for BOM
if (src[0] === 0xEF && src[1] === 0xBB && src[2] === 0xBF) {
  console.log('Has UTF-8 BOM!');
}
// Check for null bytes
for (var i = 0; i < src.length; i++) {
  if (src[i] === 0) {
    console.log('NULL byte at position', i, '(line approx', src.slice(0,i).toString().split('\n').length + ')');
    break;
  }
}
console.log('All ASCII?', /^[\x00-\x7F\n\r]*$/.test(src.toString()));
// Check line endings
var content = src.toString();
var crlfCount = (content.match(/\r\n/g) || []).length;
var lfCount = (content.match(/\n/g) || []).length;
console.log('CRLF:', crlfCount, 'LF:', lfCount);