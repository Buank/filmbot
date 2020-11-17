const pg = require("pg"),
    env = require("../app/config/env");

function poolQuery(queryDB,numeration,cl){
    const pool = new pg.Pool({
        user: env.username,
        host: env.host,
        database: env.database,
        password: env.password,
        port: env.portDatabase});
         pool.query(queryDB, (err, res) => {
        try {
            console.log('migration success: '+ numeration);
            cl(null);
            pool.end();
        } catch (err) {
            console.log('migration has already been done');
            cl(null);
            pool.end();
        }
    });
}


exports.poolQuery = poolQuery;

