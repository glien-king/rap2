const Sequelize = require('sequelize')
const chalk = require('chalk')
const config = require('../../config')

// mysql -htddl.daily2.alibaba.net -uMUX_RAP_APP -p123456 -P3306 MUX_RAP_APP
// mysql -hsh08.tddl.alibaba.com -P8507 -uMUX_RAP_APP -pcndatyba MUX_RAP_APP

const localOptions = {
  host: 'localhost',
  port: '3306',
  username: 'root',
  password: '',
  database: 'rap_idb'
}
const devOptions = {
  host: 'tddl.daily2.alibaba.net',
  port: '3306',
  username: 'MUX_RAP_APP',
  password: '',
  database: 'MUX_RAP_APP'
}
const prodOptions = {
  host: 'sh08.tddl.alibaba.com',
  port: '8507',
  username: 'MUX_RAP_APP',
  password: 'cndatyba',
  database: 'MUX_RAP_APP'
}

const options = (process.env.NODE_ENV === 'local' && localOptions) ||
    (process.env.NODE_ENV === 'development' && devOptions) ||
    prodOptions

const logging = function (sql) {
  sql = sql.replace('Executing (default): ', '')
  console.log(`${chalk.bold('SQL RAP1')} ${chalk.gray(sql)}`)
}

const db = new Sequelize(options.database, options.username, options.password, {
  host: options.host,
  port: options.port,
  dialect: 'mysql',
  retry: { match: [], max: 3 },
  logging: config.db.logging ? logging : false
})

module.exports = db
