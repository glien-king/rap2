# RAP2

[![Build Status](https://travis-ci.org/thx/rap2.svg?branch=master)](https://travis-ci.org/thx/rap2)

RAP2 is a new project based on [RAP1](https://github.com/thx/RAP).


* [Official Site: rap2.taobao.org](http://rap2.taobao.org)
* [Working Progress](https://github.com/thx/rap2/wiki)
* DingDing(钉钉交流群)：11789704

## Deployment

### build & run in development mode
```sh
# 1. Install npm & lerna
 sudo npm i -g npm@^5.5.1
 sudo npm i -g lerna@^2.5.1

 # 2. bootstrap (automatically npm install by dependencies.)
 lerna bootstrap

 # 3. init database, user=root, password=[empty string]
 lerna run create-db

 # 4. build
 lerna run build

 # 5. test
 lerna run test 

 # 6. run in development mode
 lerna run dev
```

### deploy in production server

#### rap2-delos (back-end data API server)

```sh
npm start
```

#### rap2-dolores (front-end static server)

```sh
serve -s build -p {port}
```


## Author

* Owner: Alimama FE Team
* Author:
  * Before v2.3: all by [@Nuysoft](https://github.com/nuysoft/), creator of [mockjs](mockjs.com).
  * v2.4+: [Bosn](http://github.com/bosn/)(creator of [RAP1](https://github.com/thx/RAP)) [Nuysoft](https://github.com/nuysoft/)
  * We are looking for more and more contributors :)


### Tech Arch

* Front-end (rap2-dolores)
    * React / Redux / Saga / Router
    * Mock.js
    * SASS / Bootstrap 4 beta
    * server: nginx
* Back-end (rap2-delos)
    * Koa
    * Sequelize
    * MySQL
    * Server
    * server: node
