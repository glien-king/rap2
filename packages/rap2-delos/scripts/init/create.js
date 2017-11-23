const config = require('../../config')
const Sequelize = require('Sequelize')

async function create() {
  const sequelize = new Sequelize({
    username : config.db.username,
    password : config.db.password,
    host: config.db.host,
    port: config.db.port,
    dialect: config.db.dialect,
    pool: config.db.pool,
    logging: config.db.logging
  })

  await sequelize.query(`CREATE DATABASE IF NOT EXISTS ${config.db.database} DEFAULT CHARSET utf8 COLLATE utf8_general_ci`, {
    type : sequelize.QueryTypes.RAW }).catch(e => console.error(e))
}


module.exports = create;
