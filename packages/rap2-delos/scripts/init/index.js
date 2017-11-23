/**
 * initialize database
 */
async function main () {
  const create = require('./create')
  await create()
  const { init, after } = require('./delos')
  await init()
  await after()
}

main()
