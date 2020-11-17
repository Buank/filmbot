const express = require('express'),
     app = express(),
     env = require('./app/config/env'),
     bodyParser = require('body-parser'),
     orm = require('orm'),
     dbModel = require('./db-model');

const routerChannelList = require('./api/routes/channellist');

const cronLastVideo = require('./app/bot-logic');

// DATABASE
let conString = env.dialect+'://'+env.username+':'+env.password+'@'+env.host+':'+env.portDatabase+'/'+env.database;
// 'pg://bot:123321@localhost:5432/bot_db'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

app.use(orm.express(conString, {
    define: function (db, models) {
        models.films = db.define(dbModel.table, dbModel.columnsType);
        models.params = db.define(dbModel.tableParams, dbModel.paramsType);
        models.keys = db.define(dbModel.tableKeys, dbModel.keysType);
    }
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static('web'));

app.listen(2000, function(){
    console.info('Start server a success');
});

// app.get('/', function (req, res) {
//     res.sendFile(__dirname + '/web/index.html');
// });

app.get('/dist/style.css', function (req, res) {
    res.sendFile(__dirname + '/dist/style.css');
});

app.use('/channelList', routerChannelList.rout);

// app.use('/trends', routerTrends.rout);completed - written off

cronLastVideo.actionCronLastVideo();
