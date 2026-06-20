const express = require('express');
const path = require('path');
const app = express();
app.use(express.static(path.join(__dirname, 'frontend')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'index.html')));
app.listen(9000, () => console.log('✅ Admin panel running on port 9000'));