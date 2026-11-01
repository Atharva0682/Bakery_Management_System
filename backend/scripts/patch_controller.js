const fs = require('fs');
const file = './backend/src/controllers/batchController.js';
let c = fs.readFileSync(file, 'utf8');
c = c.replace(
  "bakerId: bakerId || (req.user.role === 'baker' ? req.user.id : null),",
  "bakerId: bakerId || null,\n        taskType: req.query.taskType || null,"
);
fs.writeFileSync(file, c);
console.log('batchController patched');

