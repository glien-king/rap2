// NODE_ENV=local node scripts/migration/index.js
// ./node_modules/node/bin/node ./scripts/migration/index.js
// migration/index.js user|organization|repository 189
// ./node_modules/node/bin/node ./scripts/migration/index.js user
// ./node_modules/node/bin/node ./scripts/migration/index.js organization
// ./node_modules/node/bin/node ./scripts/migration/index.js repository
// ./node_modules/node/bin/node ./scripts/migration/index.js lock 189
// ./node_modules/node/bin/node ./scripts/migration/index.js unlock 189
const start = async () => {
  const migration = require('./migration')

  process.argv.forEach((val, index) => console.log(`${index}: ${val}`))
  let target = process.argv[2]
  let targetIds = process.argv.slice(3)
  switch (target) {
    case 'user':
    case 'organization':
    case 'repository':
    case 'lock':
    case 'unlock':
      if (targetIds.length) {
        for (let i = 0; i < targetIds.length; i++) {
          await migration[target](targetIds[i])
        }
      } else {
        await migration[target]()
      }
      break
    default:
      await migration()
  }
}

if (process.env.NODE_ENV === 'local') {
  start()
} else {
  const kc = require('../keycenter')
  kc.ready(async () => {
    let config = require('../../config')
    if (config.keycenter) {
      config.db.password = await kc.decrypt(config.db.password, config.keycenter)
    }
    start()
  })
}
