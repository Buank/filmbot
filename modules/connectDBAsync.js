const orm = require("orm"),
    env = require("../app/config/env");

let conString = env.dialect+'://'+env.username+':'+env.password+'@'+env.host+':'+env.portDatabase+'/'+env.database;

function connectDB(callback){
    orm.connect(conString, function (err, db) {
        let params  = db.define("params", {
            id: {type:'serial', key: true},
            nick: {type: 'text'},
            token:{type: 'text'},
        });
        callback(params);
    });
}
exports.connectDB = connectDB;


