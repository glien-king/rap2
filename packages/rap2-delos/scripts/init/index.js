// NODE_ENV=local node scripts/init/index.js
const { init, after } = require('./delos')
async function doit () {
  await init()
  await after()
}
doit()
