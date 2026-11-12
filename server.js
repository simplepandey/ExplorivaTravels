'use strict';
const config = require('./src/config');
const { createApp } = require('./src/app');

createApp()
  .then((app) => app.listen(config.port, () => console.log(`${config.brand} running at http://localhost:${config.port}`)))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
