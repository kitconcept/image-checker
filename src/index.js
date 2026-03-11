const core = require('@actions/core');
const { run } = require('./checker');

run().catch((error) => {
  core.setFailed(error.message);
});
