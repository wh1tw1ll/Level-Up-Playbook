var fs = require('fs');
var vm = require('vm');
var src = fs.readFileSync('app.js', 'utf8');
var lines = src.split('\n');

// Binary search within first 200 lines
var lo = 0, hi = 200;
while (lo < hi) {
  var mid = Math.floor((lo + hi) / 2);
  try {
    new vm.Script(lines.slice(0, mid).join('\n'), {filename:'app.js'});
    lo = mid + 1;
  } catch(e) {
    hi = mid;
  }
}
console.log('First error at or before line', lo);
console.log('Surrounding lines:');
for (var j = Math.max(0, lo-5); j < Math.min(lines.length, lo+3); j++) {
  console.log('  ' + (j+1) + ': ' + lines[j].slice(0, 150));
}