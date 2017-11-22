const readline = require('readline')
const Sequelize = require('sequelize')
const moment = require('moment')
const config = require('../../config') // eslint-disable-line no-unused-vars
// config.db.logging = false
const { User, Organization, Repository, Module, Interface, Property } = require('../../src/models')
const Paginaztion = require('../../src/routes/utils/pagination')
const rap1 = require('./db')
const SELECT = { type: Sequelize.QueryTypes.SELECT }
const UPDATE = { type: Sequelize.QueryTypes.UPDATE }

function dots (log) {
  try {
    readline.clearLine(process.stdout)
    readline.cursorTo(process.stdout, 0)
    process.stdout.write(log)
  } catch (e) {
    console.log(log, e.message)
  }
}

async function upsert (Model, next) {
  let exist = await Model.findOne({
    where: { id: next.id },
    paranoid: false
  })
  if (exist) {
    await Model.update(next, {
      where: { id: next.id }
    })
  } else {
    exist = await Model.create(next)
  }
  return exist
}

async function _migrationUser (start, limit, step) {
  let rows = await rap1.query(`SELECT * FROM tb_user LIMIT ${start},${limit}`, SELECT)
  for (let index in rows) {
    let row = rows[index]
    if (!row.emp_id) continue
    let next = {
      empId: row.emp_id,
      fullname: row.name,
      email: row.email,
      createdAt: moment(row.create_date).toDate(),
      deletedAt: null
    }
    step(next)
    try {
      // await upsert(User, next)
      let exist = await User.findOne({
        where: { empId: next.empId },
        paranoid: false
      })
      if (exist) {
        await User.update(next, {
          where: { empId: next.empId }
        })
      } else {
        exist = await User.create(next)
      }
    } catch (e) {
      console.log(next, e)
    }
  }
}

async function migrationUser (userId) {
  let rows = await rap1.query(`SELECT count(*) as total FROM tb_user`, SELECT)
  let pagination = new Paginaztion(rows[0].total, 1, 100)
  for (var cursor = 1; cursor <= pagination.pages; cursor++) {
    pagination.setCursor(cursor)
    await _migrationUser(pagination.start, pagination.limit, (next) => {
      dots(`User         ${pagination.total}/${pagination.start}~${pagination.end} ${next.id} ${next.fullname}`)
    })
  }
  dots(`User         ${pagination.total} \n`)
}

async function _migrationOrganization (start, limit, step) {
  let groups = await rap1.query(`SELECT * FROM tb_group LIMIT ${start},${limit}`, SELECT)
  for (let group of groups) {
    let user = (await rap1.query(`SELECT * FROM tb_user WHERE id=${group.user_id}`, SELECT))[0]
    let creator = await User.findOne({ where: { empId: user.emp_id } })
    if (!creator) continue
    let product = (await rap1.query(`SELECT * FROM tb_production_line WHERE id=${group.production_line_id}`, SELECT))[0]
    if (!product) continue
    let corporation = (await rap1.query(`SELECT * FROM tb_corporation WHERE id=${product.corporation_id}`, SELECT))[0]
    if (!corporation) continue

    let next = {
      id: group.id,
      name: `${corporation.name}_${product.name}_${group.name}`,
      description: group.description,
      logo: group.logo_url,
      visibility: { 10: false, 20: true }[corporation.access_type],
      creatorId: creator.id,
      ownerId: creator.id,
      deletedAt: null
    }
    step(next)
    let rap2Organization = await upsert(Organization, next)
    let memberIds = await rap1.query(`SELECT * FROM tb_corporation_and_user WHERE corporation_id=${rap2Organization.id}`, SELECT)
    if (memberIds.length) {
      let empIds = await rap1.query(`SELECT * FROM tb_user WHERE id IN (${memberIds.map(item => item.user_id).join(',')})`, SELECT)
      let members = await User.findAll({ where: { empId: empIds.map(item => item.emp_id) } })
      await rap2Organization.addMembers(members) // 不覆盖已有成员
    }
  }
}

async function migrationOrganization (organizationId) {
  let rows = await rap1.query(`SELECT count(*) as total FROM tb_group`, SELECT)
  let pagination = new Paginaztion(rows[0].total, 1, 100)
  for (var cursor = 1; cursor <= pagination.pages; cursor++) {
    pagination.setCursor(cursor)
    await _migrationOrganization(pagination.start, pagination.limit, (next) => {
      dots(`Organization ${pagination.total}/${pagination.start}~${pagination.end} ${next.id} ${next.name}`)
    })
  }
  dots(`Organization ${pagination.total} \n`)
}

async function _migrationRepository (rap1Project, step) {
  let user = (await rap1.query(`SELECT * FROM tb_user WHERE id=${rap1Project.user_id}`, SELECT))[0]
  let creator = await User.findOne({ where: { empId: user.emp_id } })
  if (!creator) return
  let nextRepository = {
    id: rap1Project.id,
    name: rap1Project.name,
    description: rap1Project.introduction,
    creatorId: creator.id,
    ownerId: creator.id,
    organizationId: rap1Project.group_id,
    deletedAt: null
  }
  step(nextRepository)

  // 先迁移协同仓库
  if (rap1Project.related_ids) {
    let rap2Collaborators = await rap1.query(`SELECT * FROM tb_project WHERE id IN (${rap1Project.related_ids.split(',')})`, SELECT)
    for (let rap2Collaborator of rap2Collaborators) {
      await _migrationRepository(rap2Collaborator, step)
    }
  }

  let rap2Repository = await upsert(Repository, nextRepository)
  let memberIds = await rap1.query(`SELECT * FROM tb_project_and_user WHERE project_id=${rap2Repository.id}`, SELECT)
  if (memberIds.length) {
    let empIds = await rap1.query(`SELECT * FROM tb_user WHERE id IN (${memberIds.map(item => item.user_id).join(',')})`, SELECT)
    let members = await User.findAll({ where: { empId: empIds.map(item => item.emp_id) } })
    await rap2Repository.addMembers(members) // 不覆盖成员
  }
  // 设置协同关系
  if (rap1Project.related_ids) {
    let collaborators = await Repository.findAll({ where: { id: rap1Project.related_ids.split(',') } })
    await rap2Repository.setCollaborators(collaborators)
  }

  try {
    let projectData = eval('(' + rap1Project.project_data + ')') // eslint-disable-line no-eval
    for (let rap1Module of projectData.moduleList) {
      await migrationModule(rap1Module, rap2Repository, step)
    }
  } catch (e) {
    console.log(rap1Project.id, e)
  }
}

async function _queryAndMigrationRepositoryList (start, limit, step) {
  let rap1Projects = await rap1.query(`SELECT * FROM tb_project LIMIT ${start},${limit}`, SELECT)
  for (let rap1Project of rap1Projects) {
    await _migrationRepository(rap1Project, step)
  }
}

// DONE 2.2 迁移之后要锁定指定仓库
// DONE 2.2 协同仓库 related_ids
async function migrationRepository (repositoryId) {
  if (repositoryId) {
    let rap1Project = (await rap1.query(`SELECT * FROM tb_project WHERE id=${repositoryId}`, SELECT))[0]
    await _migrationRepository(rap1Project, (next, mod, itf, property) => {
      let log = `Repository   ${next.id} ${next.name}`
      if (mod) log += ` / ${mod.id} ${mod.name}`
      if (itf) log += ` / ${itf.id} ${itf.name}`
      if (property) log += ` / ${property.id} ${property.name}`
      dots(log) // console.log(log)
    })
    dots(`Repository   ${rap1Project.id} ${rap1Project.name} \n`)
    return
  }

  let rows = await rap1.query(`SELECT count(*) as total FROM tb_project`, SELECT)
  let pagination = new Paginaztion(rows[0].total, 1, 10)
  for (var cursor = 1; cursor <= pagination.pages; cursor++) {
    pagination.setCursor(cursor)
    await _queryAndMigrationRepositoryList(pagination.start, pagination.limit, (next, mod, itf, property) => {
      let log = `Repository   ${pagination.total}/${pagination.start}~${pagination.end} ${next.id} ${next.name}`
      if (mod) log += ` ${mod.id} ${mod.name}`
      if (itf) log += ` ${itf.id} ${itf.name}`
      if (property) log += ` ${property.id} ${property.name}`
      dots(log)
    })
  }
  dots(`Repository   ${pagination.total} \n`)
}

// DONE 2.1 是否修正模块名称中的『（点击编辑后双击修改）』
async function migrationModule (rap1Module, rap2Repository, step) {
  let name = rap1Module.name.replace('（点击编辑后双击修改）', '')
  let nextModdule = {
    id: rap1Module.id,
    name,
    description: rap1Module.introduction,
    creatorId: rap2Repository.creatorId,
    repositoryId: rap2Repository.id,
    deletedAt: null
  }
  step(rap2Repository, nextModdule)
  let rap2Module = await upsert(Module, nextModdule)
  for (let rap1Page of rap1Module.pageList) {
    for (let rap1Action of rap1Page.actionList) {
      await migrationInterface(rap1Action, rap2Repository, rap2Module, step)
    }
  }
}

async function migrationInterface (rap1Action, rap2Repository, rap2Module, step) {
  let nextInterface = {
    id: rap1Action.id,
    name: rap1Action.name,
    description: rap1Action.description,
    method: { 1: 'GET', 2: 'POST', 3: 'PUT', 4: 'DELETE' }[rap1Action.requestType],
    url: rap1Action.requestUrl,
    creatorId: rap2Repository.creatorId,
    repositoryId: rap2Repository.id,
    moduleId: rap2Module.id
  }
  step(rap2Repository, rap2Module, nextInterface)
  let rap2Interface = await upsert(Interface, nextInterface)
  for (let rap1Property of rap1Action.requestParameterList) {
    await migrationProperty(rap1Property, 'request', -1, rap2Repository, rap2Module, rap2Interface, step)
  }
  for (let rap1Property of rap1Action.responseParameterList) {
    await migrationProperty(rap1Property, 'response', -1, rap2Repository, rap2Module, rap2Interface, step)
  }
}

async function migrationProperty (rap1Property, scope, parentId, rap2Repository, rap2Module, rap2Interface, step) {
  let RE_REMARK_MOCK = /@mock=(.+)$/
  let ramarkMatchMock = RE_REMARK_MOCK.exec(rap1Property.remark)
  let remarkWithoutMock = rap1Property.remark.replace(RE_REMARK_MOCK, '')

  let name = rap1Property.identifier.split('|')[0]
  let rule = rap1Property.identifier.split('|')[1] || ''
  let type = (rap1Property.dataType || 'string').split('<')[0] // array<number|string|object|boolean> => Array
  type = type[0].toUpperCase() + type.slice(1) // foo => Foo
  let value = (ramarkMatchMock && ramarkMatchMock[1]) || ''

  if (/^function/.test(value)) type = 'Function' // @mock=function(){} => Function
  if (/^\$order/.test(value)) { // $order => Array|+1
    type = 'Array'
    rule = '+1'
    let orderArgs = /\$order\((.+)\)/.exec(value)
    if (orderArgs) value = `[${orderArgs[1]}]`
  }

  let description = []
  if (rap1Property.name) description.push(rap1Property.name)
  if (rap1Property.remark && remarkWithoutMock) description.push(remarkWithoutMock)

  let nextProperty = {
    id: rap1Property.id,
    scope,
    name,
    type,
    rule,
    value,
    description: description.join('\n'),
    parentId,
    creatorId: rap2Repository.creatorId,
    repositoryId: rap2Repository.id,
    moduleId: rap2Module.id,
    interfaceId: rap2Interface.id,
    deletedAt: null
  }
  step(rap2Repository, rap2Module, rap2Interface, nextProperty)
  let rap2Property = await upsert(Property, nextProperty)
  for (let child of rap1Property.parameterList) {
    await migrationProperty(child, scope, rap2Property.id, rap2Repository, rap2Module, rap2Interface, step)
  }
}

async function lockRepository (repositoryId) {
  if (!repositoryId) return

  let rap1Project = (await rap1.query(`SELECT * FROM tb_project WHERE id=${repositoryId}`, SELECT))[0]
  if (rap1Project.related_ids) {
    await rap1.query(`UPDATE tb_project SET stage=4 WHERE id IN (${rap1Project.related_ids})`, UPDATE)
  }

  let result = await rap1.query(`UPDATE tb_project SET stage=4 WHERE id=${repositoryId}`, UPDATE)
  dots(`Repository   ${repositoryId} ${result}\n`)
}

async function unlockRepository (repositoryId) {
  if (!repositoryId) return

  let rap1Project = (await rap1.query(`SELECT * FROM tb_project WHERE id=${repositoryId}`, SELECT))[0]
  if (rap1Project.related_ids) {
    await rap1.query(`UPDATE tb_project SET stage=1 WHERE id IN (${rap1Project.related_ids})`, UPDATE)
  }

  let result = await rap1.query(`UPDATE tb_project SET stage=1 WHERE id=${repositoryId}`, UPDATE)
  dots(`Repository   ${repositoryId} ${result}\n`)
}

async function getStage (repositoryId) {
  if (!repositoryId) return
  let result = await rap1.query(`SELECT stage FROM tb_project WHERE id=${repositoryId}`, SELECT)
  if (!result.length) return
  return result[0].stage
}

async function migration () {
  await migrationUser()
  await migrationOrganization()
  await migrationRepository()
}

migration.user = migrationUser
migration.organization = migrationOrganization
migration.repository = migrationRepository
migration.lock = lockRepository
migration.unlock = unlockRepository
migration.stage = getStage

module.exports = migration
