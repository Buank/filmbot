const  pool = require("../modules/pool");

function migration(){
    let numMig = 1;
    pool.poolQuery("CREATE TABLE films(id SERIAL PRIMARY KEY NOT NULL, original_id integer, title VARCHAR(255), link VARCHAR(255), status integer)", numMig ,(cl) =>{
        numMig++;//1
        pool.poolQuery("CREATE TABLE keys(id SERIAL PRIMARY KEY NOT NULL, keytoken VARCHAR(255))", numMig ,(cl) =>{
            numMig++;//2
            pool.poolQuery("CREATE TABLE params(id SERIAL PRIMARY KEY NOT NULL, nick VARCHAR(255), token VARCHAR(255))", numMig ,(cl) =>{
                numMig++;//3
                pool.poolQuery("INSERT INTO params ( id,nick , token) VALUES (1,'system','73b686a64aeaab3cada13278b73fb9c2899f14a1') ON CONFLICT (id) DO NOTHING",numMig,(cl) =>{
                    numMig++;//4
                });
            });
        });
    });
}

migration();

