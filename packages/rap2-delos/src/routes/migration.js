const router = require('./router')
const migration = require('../../scripts/migration/migration')
// let _ = require('underscore')

// TODO 2.3 迁移期间采用单 worker 机制，迁移后恢复
const TASKS = {}
const doit = async (repositoryId) => {
  if (repositoryId in TASKS) return

  let stage = await migration.stage(repositoryId)
  if (stage === 4) {
    TASKS[repositoryId] = 100
    return
  }

  await migration.repository(repositoryId)
  await migration.lock(repositoryId)

  TASKS[repositoryId] = 0
  for (let i = 0; i < 100; i++) {
    let percent = await new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve(i + 1)
      }, Math.random() * 500)
    })
    TASKS[repositoryId] = percent
  }
}

router.post('/app/migrate', async (ctx, next) => {
  let { repositoryId } = ctx.request.body
  if (!repositoryId) return
  doit(repositoryId)
  ctx.type = 'json'
  ctx.body = {
    percent: TASKS[repositoryId] || 0
  }
})

router.get('/app/migrate/progress/:repositoryId', async (ctx, next) => {
  let { repositoryId } = ctx.params
  let stage = await migration.stage(repositoryId)
  let percent = stage === 4 ? 100 : TASKS[repositoryId]
  ctx.body = {
    percent
  }
})
