const { markPendingPurge } = require("./services/trashStore");

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

function startTrashScheduler() {
  async function run() {
    try {
      await markPendingPurge();
    } catch (err) {
      console.error("Trash scheduler error:", err.message);
    }
  }

  run();
  return setInterval(run, CHECK_INTERVAL_MS);
}

module.exports = { startTrashScheduler };
